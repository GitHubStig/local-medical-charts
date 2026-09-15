import { assertEquals } from "@std/assert";
import type { ImportJob, ImportStatus } from "../types.ts";
import { quitWarning } from "./quit.ts";

const job = (id: number, status: ImportStatus): ImportJob => ({
  id,
  fileNames: [`report-${id}.pdf`],
  source: "pdf",
  pageCount: 2,
  pagesRead: status === "ready" ? 2 : 0,
  status,
  model: "reader-a:7b",
  addedAt: "2026-05-11T09:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  error: null,
  resultCount: null,
});

Deno.test("quitting with nothing unsaved asks nothing", () => {
  assertEquals(quitWarning([]), null);
  assertEquals(quitWarning([job(1, "failed"), job(2, "cancelled")]), null);
});

Deno.test("quitting with an unsaved reading asks first", () => {
  assertEquals(
    quitWarning([job(1, "ready"), job(2, "failed")]),
    "Quit Local Medical Charts? A reading isn't saved yet and will be lost.",
  );
});

Deno.test("waiting, reading and ready imports all count as unsaved", () => {
  assertEquals(
    quitWarning([job(1, "ready"), job(2, "reading"), job(3, "waiting")]),
    "Quit Local Medical Charts? 3 readings aren't saved yet and will be lost.",
  );
});
