import { assert, assertEquals } from "@std/assert";
import type { ImportJob } from "../types.ts";
import { readingNotice } from "./notice.ts";

// A fictional file name that says who the report is for, as real ones often do.
const job = (patch: Partial<ImportJob> = {}): ImportJob => ({
  id: 3,
  fileNames: ["alex-tan-harbour-medical-lab.pdf"],
  source: "pdf",
  pageCount: 6,
  pagesRead: 6,
  status: "ready",
  model: "reader-a:7b",
  addedAt: "2026-05-11T09:00:00.000Z",
  startedAt: "2026-05-11T09:00:00.000Z",
  finishedAt: "2026-05-11T09:06:00.000Z",
  error: null,
  resultCount: 14,
  ...patch,
});

Deno.test("a ready import's notice opens its review", () => {
  assertEquals(readingNotice(job()), {
    title: "Report ready to review",
    body: "6 pages read. Check the results before saving.",
    tag: "medical-charts-import-3",
    href: "#/review/3",
  });
  assertEquals(
    readingNotice(job({ pageCount: 1 }))?.body,
    "1 page read. Check the results before saving.",
  );
});

Deno.test("a failed import's notice opens the imports panel", () => {
  assertEquals(
    readingNotice(job({
      status: "failed",
      pagesRead: 2,
      error: "reader-a:7b kept repeating itself on page 3 and was stopped.",
      resultCount: null,
    })),
    {
      title: "Couldn't read a report",
      body: "Open Medical Charts to see why and try again.",
      tag: "medical-charts-import-3",
      href: "#/",
    },
  );
});

Deno.test("imports that aren't finished, or were cancelled, have no notice", () => {
  for (const status of ["waiting", "reading", "cancelled"] as const) {
    assertEquals(readingNotice(job({ status })), null, status);
  }
});

Deno.test("a notice never includes the file name, the model or the error", () => {
  for (
    const notice of [
      readingNotice(job()),
      readingNotice(job({ status: "failed", error: "Harbour Medical Lab" })),
    ]
  ) {
    const text = `${notice?.title} ${notice?.body}`.toLowerCase();
    for (const secret of ["alex", "tan", "harbour", "reader-a", "14"]) {
      assert(!text.includes(secret), `"${secret}" in "${text}"`);
    }
  }
});
