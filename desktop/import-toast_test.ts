import { assertEquals } from "@std/assert";
import { importToast } from "../app/src/lib/import-toast.ts";
import type { ImportOutcome } from "./contract.ts";

// Made-up files and patients only.

const summary = {
  patientName: "ALEX EXAMPLE",
  collectedAt: "2025-05-20T08:30:00",
  providerName: "Example Lab",
  resultCount: 14,
};
const added = (fileName: string, warnings: string[] = []): ImportOutcome => ({
  fileName,
  status: "added",
  patientId: 1,
  reportId: 1,
  warnings,
  summary,
});

Deno.test("a clean import says what was filed, and closes by itself", () => {
  assertEquals(importToast([added("a.json"), added("b.json")]), {
    title: "2 reports added",
    rows: [
      {
        key: "0",
        tone: "added",
        fileName: "a.json",
        detail: "Alex Example · 20 May 2025 · Example Lab · 14 results",
        warnings: [],
      },
      {
        key: "1",
        tone: "added",
        fileName: "b.json",
        detail: "Alex Example · 20 May 2025 · Example Lab · 14 results",
        warnings: [],
      },
    ],
    sticky: false,
  });
});

Deno.test("files already imported say so, and still close by themselves", () => {
  const duplicate: ImportOutcome = {
    fileName: "a.json",
    status: "duplicate",
    patientId: 1,
    reportId: 1,
    warnings: [],
    summary,
  };
  const toast = importToast([duplicate]);
  assertEquals(toast.title, "Already imported");
  assertEquals(
    toast.rows[0].detail,
    "Already imported · Alex Example · 20 May 2025 · Example Lab · 14 results",
  );
  assertEquals(toast.sticky, false);
});

Deno.test("a problem or a warning keeps the card open until it's closed", () => {
  const withWarning = importToast([
    added("a.json", ["The ID number matches Alex Example, but …"]),
  ]);
  assertEquals([withWarning.title, withWarning.sticky], [
    "1 report added",
    true,
  ]);

  const mixed = importToast([
    added("a.json"),
    {
      fileName: "notes.txt",
      status: "rejected",
      error: "notes.txt: not a report",
    },
  ]);
  assertEquals(mixed.title, "1 added · 1 couldn't be imported");
  assertEquals(mixed.rows[1], {
    key: "1",
    tone: "rejected",
    fileName: "notes.txt",
    detail: "notes.txt: not a report",
    warnings: [],
  });
  assertEquals(mixed.sticky, true);

  assertEquals(
    importToast([{ fileName: "x", status: "rejected", error: "no" }]).title,
    "Couldn't import the file",
  );
});
