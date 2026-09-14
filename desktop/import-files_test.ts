import { assertEquals } from "@std/assert";
import {
  describeImport,
  filesToSend,
  mergeOutcomes,
  prepareImport,
  summarizeImport,
} from "../app/src/lib/import-files.ts";
import type { ImportOutcome } from "./contract.ts";

/** How the tests' made-up outcomes describe their report: nothing to say. */
const FILED = {
  patientName: null,
  collectedAt: null,
  providerName: null,
  resultCount: 0,
};

// Synthetic files only.

Deno.test("prepareImport reads .json files and answers the rest itself, in order", async () => {
  const prepared = await prepareImport([
    new File(['{"a": 1}'], "one.json"),
    new File(["hello"], "notes.txt"),
    new File(["x".repeat(50)], "huge.json"),
    new File(["{}"], "TWO.JSON"),
  ], { maxBytes: 20 });

  assertEquals(prepared[0], { name: "one.json", text: '{"a": 1}' });
  assertEquals(prepared[1], {
    fileName: "notes.txt",
    status: "rejected",
    error: "notes.txt: only .json report files can be imported",
  });
  assertEquals((prepared[2] as { status: string }).status, "rejected");
  assertEquals(prepared[3], { name: "TWO.JSON", text: "{}" });
  assertEquals(filesToSend(prepared).map((f) => f.name), [
    "one.json",
    "TWO.JSON",
  ]);
});

Deno.test("mergeOutcomes puts the bindings' answers back in picked order", async () => {
  const prepared = await prepareImport([
    new File(["{}"], "a.json"),
    new File([""], "b.txt"),
    new File(["{}"], "c.json"),
  ]);
  const sent: ImportOutcome[] = [
    {
      fileName: "a.json",
      status: "added",
      patientId: 1,
      reportId: 1,
      summary: FILED,
      warnings: [],
    },
    {
      fileName: "c.json",
      status: "duplicate",
      patientId: 1,
      reportId: 1,
      summary: FILED,
      warnings: [],
    },
  ];
  assertEquals(
    mergeOutcomes(prepared, sent).map((o) => [o.fileName, o.status]),
    [
      ["a.json", "added"],
      ["b.txt", "rejected"],
      ["c.json", "duplicate"],
    ],
  );
});

Deno.test("summaries count outcomes and warnings", () => {
  const outcomes: ImportOutcome[] = [
    {
      fileName: "a.json",
      status: "added",
      patientId: 1,
      reportId: 1,
      summary: FILED,
      warnings: ["check the ID"],
    },
    {
      fileName: "b.json",
      status: "added",
      patientId: 1,
      reportId: 2,
      summary: FILED,
      warnings: [],
    },
    {
      fileName: "c.json",
      status: "duplicate",
      patientId: 1,
      reportId: 1,
      summary: FILED,
      warnings: [],
    },
    { fileName: "d.txt", status: "rejected", error: "no" },
  ];
  const summary = summarizeImport(outcomes);
  assertEquals(summary, { added: 2, duplicates: 1, rejected: 1, warnings: 1 });
  assertEquals(
    describeImport(summary),
    "2 added · 1 already imported · 1 couldn't be imported",
  );
  assertEquals(describeImport(summarizeImport([])), "No files");
});
