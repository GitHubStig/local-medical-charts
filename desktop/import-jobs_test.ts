import { assertEquals } from "@std/assert";
import {
  jobKind,
  jobStatus,
  panelHeading,
} from "../app/src/lib/import-jobs.ts";
import type { ImportJob } from "./contract.ts";

const job = (overrides: Partial<ImportJob> = {}): ImportJob => ({
  id: 1,
  fileNames: ["example.pdf"],
  source: "pdf",
  pageCount: 3,
  pagesRead: 0,
  status: "waiting",
  model: null,
  addedAt: "2026-05-11T09:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  error: null,
  resultCount: null,
  ...overrides,
});
const now = new Date("2026-05-11T09:01:12.000Z");

Deno.test("each import says what it is", () => {
  assertEquals(jobKind(job()), "PDF · 3 pages");
  assertEquals(jobKind(job({ pageCount: 1 })), "PDF · 1 page");
  assertEquals(
    jobKind(job({ source: "photos", pageCount: 2 })),
    "2 photos · one report",
  );
  assertEquals(jobKind(job({ source: "photos", pageCount: 1 })), "1 photo");
});

Deno.test("the heading counts what's still being read, then what's ready", () => {
  assertEquals(
    panelHeading([job({ status: "reading" }), job(), job({ status: "ready" })]),
    "Reading 2 reports",
  );
  assertEquals(
    panelHeading([job({ status: "ready" })]),
    "1 report ready to review",
  );
  assertEquals(panelHeading([job({ status: "failed" })]), "1 report not read");
});

Deno.test("each status reads in words, with progress while reading", () => {
  assertEquals(
    jobStatus(
      job({
        status: "reading",
        pagesRead: 1,
        startedAt: "2026-05-11T09:00:00.000Z",
      }),
      now,
    ),
    {
      tone: "reading",
      text: "Reading page 2 of 3",
      elapsed: "1 min, 12 sec",
      progress: 1 / 3,
    },
  );
  assertEquals(jobStatus(job(), now), {
    tone: "quiet",
    text: "Waiting its turn",
  });
  assertEquals(
    jobStatus(
      job({
        status: "ready",
        pagesRead: 3,
        startedAt: "2026-05-11T09:00:00.000Z",
        finishedAt: "2026-05-11T09:02:04.000Z",
        resultCount: 8,
      }),
      now,
    ),
    { tone: "done", text: "Read in 2 min, 4 sec · 8 results" },
  );
  assertEquals(
    jobStatus(
      job({
        status: "failed",
        error: "Couldn't reach Ollama at localhost:11434. Is it running?",
      }),
      now,
    ),
    {
      tone: "problem",
      text: "Couldn't reach Ollama at localhost:11434. Is it running?",
    },
  );
  assertEquals(jobStatus(job({ status: "cancelled", pagesRead: 1 }), now), {
    tone: "quiet",
    text: "Cancelled after 1 page of 3",
  });
  assertEquals(jobStatus(job({ status: "cancelled" }), now).text, "Cancelled");
});
