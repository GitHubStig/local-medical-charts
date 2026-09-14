/**
 * Reads uploads into reports in the background, one import at a time.
 *
 * Everything lives in memory: the page images, what the model read, the merged
 * report. Nothing reaches the database until a person reviews the report and
 * saves it (desktop/bindings.ts), and discarding an import, or quitting the
 * app, forgets its files.
 */
import type { CatalogIndex } from "../../src/catalog.ts";
import { buildReport } from "../../src/normalize.ts";
import {
  type PageExtraction,
  type Report,
  ReportSchema,
} from "../../src/schema.ts";
import type { ImportJob, ImportPage, ImportStatus } from "../types.ts";
import { ImportError, importMessages } from "./messages.ts";
import type { PageReader } from "./reader.ts";
import type { PageImage, UploadFile, UploadPages } from "./sources.ts";

type PageRead = {
  model: string;
  promptHash: string;
  extractedAt: string;
  extraction: PageExtraction;
};

type Job = {
  id: number;
  fileNames: string[];
  source: UploadPages["source"];
  /** The merged report's name. */
  report: string;
  pages: PageImage[];
  /** What was read off each page so far, by page index. */
  read: (PageRead | null)[];
  status: ImportStatus;
  model: string | null;
  addedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  merged: Report | null;
  /** Set while reading; aborting it stops the page being read. */
  controller: AbortController | null;
};

export type ImportQueueDeps = {
  /** Splits an upload into page images, throwing an ImportError for files it can't read. */
  pagesFrom: (files: UploadFile[]) => UploadPages;
  /** A reader for the current settings, asked for each time an import starts reading. */
  openReader: () => Promise<PageReader>;
  catalog: CatalogIndex;
  now?: () => Date;
  /** Told when an import becomes ready or fails; not when it's cancelled or discarded. */
  onFinished?: (job: ImportJob) => void;
};

export class ImportQueue {
  readonly #deps: ImportQueueDeps;
  readonly #now: () => Date;
  readonly #jobs = new Map<number, Job>();
  #nextId = 1;
  #running: Promise<void> | null = null;

  constructor(deps: ImportQueueDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? (() => new Date());
  }

  /** Adds an upload to the end of the queue. Throws an ImportError when its files can't be read. */
  add(files: UploadFile[]): ImportJob {
    const { source, report, pages } = this.#deps.pagesFrom(files);
    const job: Job = {
      id: this.#nextId++,
      fileNames: files.map((f) => f.name),
      source,
      report,
      pages,
      read: pages.map(() => null),
      status: "waiting",
      model: null,
      addedAt: this.#iso(),
      startedAt: null,
      finishedAt: null,
      error: null,
      merged: null,
      controller: null,
    };
    this.#jobs.set(job.id, job);
    this.#pump();
    return this.#snapshot(job);
  }

  /** Every import, in the order added. */
  list(): ImportJob[] {
    return [...this.#jobs.values()].map((job) => this.#snapshot(job));
  }

  /** Stops a waiting or reading import. Pages already read are kept for a retry. */
  cancel(id: number): ImportJob | null {
    const job = this.#jobs.get(id);
    if (!job) return null;
    if (job.status === "waiting" || job.status === "reading") {
      job.status = "cancelled";
      job.finishedAt = this.#iso();
      job.controller?.abort();
    }
    return this.#snapshot(job);
  }

  /** Queues a failed or cancelled import again. */
  retry(id: number): ImportJob | null {
    const job = this.#jobs.get(id);
    if (!job) return null;
    if (job.status === "failed" || job.status === "cancelled") {
      job.status = "waiting";
      job.error = null;
      job.finishedAt = null;
      this.#pump();
    }
    return this.#snapshot(job);
  }

  /** Forgets an import and its files, stopping it first if it's reading. */
  discard(id: number): boolean {
    const job = this.#jobs.get(id);
    if (!job) return false;
    this.#jobs.delete(id);
    job.controller?.abort();
    return true;
  }

  /** A ready import and its merged report; null for any other import. */
  review(id: number): { job: ImportJob; report: Report } | null {
    const job = this.#jobs.get(id);
    if (job?.status !== "ready" || !job.merged) return null;
    return { job: this.#snapshot(job), report: job.merged };
  }

  /** One page image, 1-based. */
  page(id: number, page: number): ImportPage | null {
    const image = this.#jobs.get(id)?.pages[page - 1];
    return image ? { ...image } : null;
  }

  /** Forgets every import, stopping the one reading. */
  clear(): void {
    const jobs = [...this.#jobs.values()];
    this.#jobs.clear();
    for (const job of jobs) job.controller?.abort();
  }

  /** Resolves once nothing is reading or waiting to. */
  async idle(): Promise<void> {
    while (this.#running) await this.#running;
  }

  #iso(): string {
    return this.#now().toISOString();
  }

  #snapshot(job: Job): ImportJob {
    return {
      id: job.id,
      fileNames: [...job.fileNames],
      source: job.source,
      pageCount: job.pages.length,
      pagesRead: job.read.filter(Boolean).length,
      status: job.status,
      model: job.model,
      addedAt: job.addedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      resultCount: job.merged?.tests.length ?? null,
    };
  }

  #finished(job: Job): void {
    try {
      this.#deps.onFinished?.(this.#snapshot(job));
    } catch (err) {
      // Telling someone is a courtesy; the reading itself is already done.
      console.error("Couldn't announce a finished import:", err);
    }
  }

  #pump(): void {
    if (this.#running) return;
    const next = [...this.#jobs.values()].find((j) => j.status === "waiting");
    if (!next) return;
    this.#running = this.#run(next).finally(() => {
      this.#running = null;
      this.#pump();
    });
  }

  /** Reads an import's unread pages, then merges them. Never rejects. */
  async #run(job: Job): Promise<void> {
    const controller = new AbortController();
    Object.assign(job, {
      status: "reading",
      controller,
      startedAt: this.#iso(),
      finishedAt: null,
      error: null,
      merged: null,
    });
    // False once the import is cancelled or discarded while a page is out.
    const current = () =>
      job.controller === controller && job.status === "reading" &&
      this.#jobs.get(job.id) === job;

    try {
      const reader = await this.#deps.openReader();
      if (!current()) return;
      job.model = reader.model;
      // Pages read by another model, or under another prompt, are read again.
      job.read = job.read.map((r) =>
        r?.model === reader.model && r.promptHash === reader.promptHash
          ? r
          : null
      );

      const pageCount = job.pages.length;
      for (const [index, image] of job.pages.entries()) {
        if (job.read[index]) continue;
        const extraction = await reader.read(
          image,
          index + 1,
          pageCount,
          controller.signal,
        );
        if (!current()) return;
        job.read[index] = {
          model: reader.model,
          promptHash: reader.promptHash,
          extractedAt: this.#iso(),
          // The queue knows which page this is; the model's count only orders pages wrongly.
          extraction: { ...extraction, page: index + 1, pageCount },
        };
      }

      const { catalog } = this.#deps;
      job.merged = ReportSchema.parse(buildReport(
        job.read.map((read, i) => ({ ...read!, image: job.pages[i].name })),
        {
          report: job.report,
          catalogHash: catalog.hash,
          mergedAt: this.#iso(),
        },
        catalog,
      ));
      job.status = "ready";
      job.finishedAt = this.#iso();
      this.#finished(job);
    } catch (err) {
      if (!current()) return;
      job.status = "failed";
      job.finishedAt = this.#iso();
      job.error = err instanceof ImportError
        ? err.message
        : importMessages.unexpected(
          err instanceof Error ? err.message : String(err),
        );
      this.#finished(job);
    } finally {
      if (job.controller === controller) job.controller = null;
    }
  }
}
