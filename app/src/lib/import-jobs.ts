/**
 * What the imports panel says about each PDF or set of photos being read.
 * Plain functions, tested in desktop/import-jobs_test.ts.
 */
import type { ImportJob } from "../../../desktop/contract.ts";
import { formatDuration, plural } from "./format.ts";

/** Still to be read: waiting its turn or reading now. */
export const isActive = (job: ImportJob) =>
  job.status === "waiting" || job.status === "reading";

/** "PDF · 3 pages", "2 photos · one report", "1 photo" */
export function jobKind(job: ImportJob): string {
  if (job.source === "pdf") return `PDF · ${plural(job.pageCount, "page")}`;
  return job.pageCount === 1
    ? "1 photo"
    : `${plural(job.pageCount, "photo")} · one report`;
}

/** "Reading 3 reports", then "2 reports ready to review" once nothing is left to read. */
export function panelHeading(jobs: readonly ImportJob[]): string {
  const active = jobs.filter(isActive).length;
  if (active) return `Reading ${plural(active, "report")}`;
  const ready = jobs.filter((j) => j.status === "ready").length;
  if (ready) return `${plural(ready, "report")} ready to review`;
  return `${plural(jobs.length, "report")} not read`;
}

export type JobStatus = {
  tone: "reading" | "quiet" | "done" | "problem";
  text: string;
  /** Time spent reading so far, while reading. */
  elapsed?: string;
  /** Share of pages read, 0 to 1, while reading. */
  progress?: number;
};

const between = (from: string | null, to: string | Date | null) =>
  from && to ? formatDuration(new Date(to).getTime() - Date.parse(from)) : null;

export function jobStatus(job: ImportJob, now: Date): JobStatus {
  switch (job.status) {
    case "reading":
      return {
        tone: "reading",
        text: `Reading page ${
          Math.min(job.pagesRead + 1, job.pageCount)
        } of ${job.pageCount}`,
        elapsed: between(job.startedAt, now) ?? undefined,
        progress: job.pageCount ? job.pagesRead / job.pageCount : 0,
      };
    case "waiting":
      return { tone: "quiet", text: "Waiting its turn" };
    case "ready": {
      const took = between(job.startedAt, job.finishedAt);
      const results = plural(job.resultCount ?? 0, "result");
      return {
        tone: "done",
        text: took ? `Read in ${took} · ${results}` : `Read · ${results}`,
      };
    }
    case "failed":
      return { tone: "problem", text: job.error ?? "Reading stopped." };
    case "cancelled":
      return {
        tone: "quiet",
        text: job.pagesRead
          ? `Cancelled after ${
            plural(job.pagesRead, "page")
          } of ${job.pageCount}`
          : "Cancelled",
      };
  }
}
