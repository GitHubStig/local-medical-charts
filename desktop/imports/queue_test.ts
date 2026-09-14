import { assert, assertEquals } from "@std/assert";
import { catalogV1, syntheticExtraction } from "../store/testing.ts";
import { ImportError } from "./messages.ts";
import { ImportQueue } from "./queue.ts";
import type { PageReader } from "./reader.ts";
import { pagesFromUpload } from "./sources.ts";

// Pages are "read" by a stand-in that returns made-up results.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const photos = (...names: string[]) =>
  names.map((name) => ({ name, bytes: PNG }));

/** Reads pages at once, or holds each read until released. Records every read. */
class StandInReader {
  calls: string[] = [];
  hold = false;
  failure: Error | null = null;
  #held: (() => void)[] = [];

  constructor(public model = "reader-a:7b", public promptHash = "prompt-1") {}

  release() {
    for (const resume of this.#held.splice(0)) resume();
  }

  open = (): Promise<PageReader> =>
    Promise.resolve({
      model: this.model,
      promptHash: this.promptHash,
      read: async (image, page, pageCount, signal) => {
        this.calls.push(`${this.model} ${image.name} ${page}/${pageCount}`);
        if (this.hold) {
          await new Promise<void>((resolve, reject) => {
            this.#held.push(resolve);
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          });
        }
        if (this.failure) throw this.failure;
        // A wrong page number on purpose: the queue knows which page it asked for.
        return syntheticExtraction({ page: 9, pageCount: 9 });
      },
    });
}

function queueFor(
  reader: StandInReader,
  openReader: () => Promise<PageReader> = reader.open,
) {
  return new ImportQueue({
    pagesFrom: pagesFromUpload,
    openReader,
    catalog: catalogV1,
    now: () => new Date("2026-05-11T09:00:00.000Z"),
  });
}

async function until(check: () => boolean) {
  for (let i = 0; i < 500; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("timed out waiting");
}

const statuses = (queue: ImportQueue) =>
  queue.list().map((job) => [job.id, job.status]);

Deno.test("imports are read one at a time, in order, and merged into reports", async () => {
  const reader = new StandInReader();
  const queue = queueFor(reader);

  assertEquals(queue.add(photos("a-1.png", "a-2.png")).status, "reading");
  assertEquals(queue.add(photos("b.png")).status, "waiting");
  await queue.idle();

  assertEquals(reader.calls, [
    "reader-a:7b a-1.png 1/2",
    "reader-a:7b a-2.png 2/2",
    "reader-a:7b b.png 1/1",
  ]);
  assertEquals(queue.list()[0], {
    id: 1,
    fileNames: ["a-1.png", "a-2.png"],
    source: "photos",
    pageCount: 2,
    pagesRead: 2,
    status: "ready",
    model: "reader-a:7b",
    addedAt: "2026-05-11T09:00:00.000Z",
    startedAt: "2026-05-11T09:00:00.000Z",
    finishedAt: "2026-05-11T09:00:00.000Z",
    error: null,
    resultCount: 6,
  });

  const { report } = queue.review(1)!;
  assertEquals(report.tests.map((t) => t.page), [1, 1, 1, 2, 2, 2]);
  assertEquals(report.source.report, "a-1");
  assertEquals(report.source.images, ["a-1.png", "a-2.png"]);
  assertEquals(report.source.model, "reader-a:7b");
  assertEquals(report.source.promptHash, "prompt-1");
  assertEquals(report.source.catalogHash, catalogV1.hash);
  assertEquals(queue.review(2)!.job.resultCount, 3);
});

Deno.test("cancelling stops the page being read; a retry carries on from there", async () => {
  const reader = new StandInReader();
  reader.hold = true;
  const queue = queueFor(reader);
  queue.add(photos("p1.png", "p2.png", "p3.png"));

  await until(() => reader.calls.length === 1);
  reader.release();
  await until(() => reader.calls.length === 2);
  assertEquals(queue.cancel(1)?.status, "cancelled");
  await queue.idle();
  assertEquals(queue.list()[0].pagesRead, 1);
  assertEquals(queue.review(1), null);

  reader.hold = false;
  assertEquals(queue.retry(1)?.status, "reading");
  await queue.idle();
  assertEquals(reader.calls.map((c) => c.split(" ")[1]), [
    "p1.png",
    "p2.png",
    "p2.png",
    "p3.png",
  ]);
  assertEquals(statuses(queue), [[1, "ready"]]);
});

Deno.test("a retry with another model reads every page again", async () => {
  const reader = new StandInReader();
  reader.hold = true;
  const queue = queueFor(reader);
  queue.add(photos("p1.png", "p2.png"));

  await until(() => reader.calls.length === 1);
  reader.release();
  await until(() => reader.calls.length === 2);
  queue.cancel(1);
  await queue.idle();

  reader.hold = false;
  reader.model = "reader-b:9b";
  queue.retry(1);
  await queue.idle();
  assertEquals(reader.calls.slice(2), [
    "reader-b:9b p1.png 1/2",
    "reader-b:9b p2.png 2/2",
  ]);
  assertEquals(queue.review(1)?.report.source.model, "reader-b:9b");
});

Deno.test("a waiting import can be cancelled before it starts", async () => {
  const reader = new StandInReader();
  const queue = queueFor(reader);
  queue.add(photos("a.png"));
  queue.add(photos("b.png"));
  assertEquals(queue.cancel(2)?.status, "cancelled");
  await queue.idle();
  assertEquals(statuses(queue), [[1, "ready"], [2, "cancelled"]]);
  assertEquals(reader.calls, ["reader-a:7b a.png 1/1"]);
  assertEquals(queue.cancel(1)?.status, "ready", "a read import stays read");
});

Deno.test("reading failures are explained, and an unexpected one still is", async () => {
  const reader = new StandInReader();
  const queue = queueFor(reader);

  reader.failure = new ImportError(
    "Couldn't reach Ollama at localhost:11434. Is it running?",
  );
  queue.add(photos("a.png"));
  await queue.idle();
  assertEquals(queue.list()[0].status, "failed");
  assertEquals(
    queue.list()[0].error,
    "Couldn't reach Ollama at localhost:11434. Is it running?",
  );

  reader.failure = new RangeError("boom");
  queue.retry(1);
  await queue.idle();
  assertEquals(queue.list()[0].error, "Reading stopped unexpectedly: boom");

  reader.failure = null;
  queue.retry(1);
  await queue.idle();
  assertEquals(queue.list()[0].status, "ready");
  assertEquals(queue.list()[0].error, null);
});

Deno.test("with no reader to open, the import fails before reading anything", async () => {
  const reader = new StandInReader();
  const queue = queueFor(
    reader,
    () =>
      Promise.reject(
        new ImportError(
          "Choose a model for reading PDFs and photos in Settings.",
        ),
      ),
  );
  queue.add(photos("a.png"));
  await queue.idle();
  assertEquals(queue.list()[0].status, "failed");
  assertEquals(
    queue.list()[0].error,
    "Choose a model for reading PDFs and photos in Settings.",
  );
  assertEquals(reader.calls, []);
});

Deno.test("discarding forgets an import, even mid-read, and the next one starts", async () => {
  const reader = new StandInReader();
  reader.hold = true;
  const queue = queueFor(reader);
  queue.add(photos("a.png"));
  queue.add(photos("b.png"));

  await until(() => reader.calls.length === 1);
  assertEquals(queue.discard(1), true);
  await until(() => reader.calls.length === 2);
  assertEquals(statuses(queue), [[2, "reading"]]);
  reader.release();
  await queue.idle();
  assertEquals(statuses(queue), [[2, "ready"]]);

  assertEquals(queue.discard(1), false);
  assertEquals(queue.page(1, 1), null);
  assertEquals(queue.cancel(1), null);
  assertEquals(queue.retry(1), null);
});

Deno.test("page images are kept for review; only ready imports have a report", async () => {
  const reader = new StandInReader();
  reader.hold = true;
  const queue = queueFor(reader);
  queue.add(photos("a-1.png", "a-2.png"));
  assertEquals(queue.review(1), null);

  assertEquals(queue.page(1, 2), {
    name: "a-2.png",
    type: "image/png",
    bytes: PNG,
    origin: "photo",
  });
  assertEquals(queue.page(1, 3), null);
  assertEquals(queue.page(1, 0), null);

  reader.hold = false;
  reader.release();
  await queue.idle();
  assert(queue.review(1));
});

Deno.test("clearing forgets every import and stops the one reading", async () => {
  const reader = new StandInReader();
  reader.hold = true;
  const queue = queueFor(reader);
  queue.add(photos("a.png"));
  queue.add(photos("b.png"));
  await until(() => reader.calls.length === 1);

  queue.clear();
  assertEquals(queue.list(), []);
  await queue.idle();
  assertEquals(reader.calls.length, 1, "nothing else was read");
});

Deno.test("the queue announces imports that become ready or fail, not cancelled ones", async () => {
  const reader = new StandInReader();
  const finished: unknown[] = [];
  const queue = new ImportQueue({
    pagesFrom: pagesFromUpload,
    openReader: reader.open,
    catalog: catalogV1,
    onFinished: (job) => finished.push([job.id, job.status]),
  });

  queue.add(photos("a.png"));
  await queue.idle();
  reader.failure = new ImportError("Couldn't reach Ollama. Is it running?");
  queue.add(photos("b.png"));
  await queue.idle();

  reader.failure = null;
  reader.hold = true;
  queue.add(photos("c.png"));
  await until(() => reader.calls.length === 3);
  queue.cancel(3);
  await queue.idle();

  assertEquals(finished, [[1, "ready"], [2, "failed"]]);
});

Deno.test("an announcement that throws doesn't stop reading", async () => {
  const reader = new StandInReader();
  const queue = new ImportQueue({
    pagesFrom: pagesFromUpload,
    openReader: reader.open,
    catalog: catalogV1,
    onFinished: () => {
      throw new Error("notifications unavailable");
    },
  });
  const error = console.error;
  console.error = () => {};
  try {
    queue.add(photos("a.png"));
    queue.add(photos("b.png"));
    await queue.idle();
  } finally {
    console.error = error;
  }
  assertEquals(statuses(queue), [[1, "ready"], [2, "ready"]]);
});
