import { assertEquals } from "@std/assert";
import {
  extractionNotes,
  filingMessage,
  reviewDetails,
  reviewRows,
  reviewSummary,
} from "../app/src/lib/review.ts";
import type { ReportWithoutPages } from "./contract.ts";
import { withoutPages } from "./report-data.ts";
import { syntheticReport } from "./store/testing.ts";

// Synthetic reports only (see store/testing.ts).

function report(warnings: string[] = []): ReportWithoutPages {
  const full = JSON.parse(syntheticReport({ haemoglobin: "16.2" }));
  return { ...withoutPages(full), warnings };
}

Deno.test("each result reads as printed, with the lab's range, flag and catalog match", () => {
  assertEquals(reviewRows(report()), [
    {
      index: 0,
      name: "Haemoglobin",
      page: 1,
      value: "16.2",
      unit: "g/dL",
      range: "12 – 15.5",
      flag: "H",
      catalogName: "Haemoglobin",
      check: false,
    },
    {
      index: 1,
      name: "Glucose",
      page: 1,
      value: "5.2",
      unit: "mmol/L",
      range: "3.9 – 6",
      flag: null,
      catalogName: "Glucose",
      check: false,
    },
    {
      index: 2,
      name: "Serum Ferritin",
      page: 1,
      value: "85",
      unit: "ng/mL",
      range: "15 – 150",
      flag: null,
      catalogName: null,
      check: false,
    },
  ]);
  assertEquals(
    reviewSummary(report()),
    "3 results · 1 flagged · 1 not in the catalog",
  );
});

Deno.test("a result an extraction note mentions on its page is marked to check", () => {
  const withNote = report([
    "p1: Haemoglobin could be 16.2 or 18.2",
    "p2: Glucose was partly covered by a stamp",
  ]);
  assertEquals(reviewRows(withNote).map((r) => [r.name, r.check]), [
    ["Haemoglobin", true],
    ["Glucose", false],
    ["Serum Ferritin", false],
  ]);
  assertEquals(extractionNotes(withNote), [
    { page: 1, text: "Haemoglobin could be 16.2 or 18.2" },
    { page: 2, text: "Glucose was partly covered by a stamp" },
  ]);
  assertEquals(extractionNotes(report(["A unit couldn't be read"])), [
    { page: null, text: "A unit couldn't be read" },
  ]);
});

Deno.test("the details show who and where the report is about, as read", () => {
  assertEquals(reviewDetails(report()), [
    {
      label: "Patient",
      value: "Alex Example · born 15 Aug 1990 · ID X1234567",
    },
    { label: "Lab", value: "Example Lab" },
    { label: "Dates", value: "Collected 14 Jan 2025, 08:30" },
    { label: "Doctor", value: "Dr Example" },
  ]);
});

Deno.test("the filing banner says where the report goes, and what to check first", () => {
  assertEquals(
    filingMessage({
      patient: {
        kind: "existing",
        id: 1,
        name: "ALEX EXAMPLE",
        matchedBy: "id-number",
      },
      warnings: [],
      similarReport: null,
    }),
    {
      tone: "match",
      before: "Will be added to ",
      name: "Alex Example",
      after: ". The ID number matches.",
      notes: [],
    },
  );
  assertEquals(
    filingMessage({
      patient: { kind: "new", name: "SAM EXAMPLE" },
      warnings: [],
      similarReport: null,
    }).before + "Sam Example.",
    "Will start a new patient, Sam Example.",
  );

  const similar = filingMessage({
    patient: {
      kind: "existing",
      id: 1,
      name: "ALEX EXAMPLE",
      matchedBy: "name-and-birth-date",
    },
    warnings: [],
    similarReport: { id: 4, fileName: "example.pdf" },
  });
  assertEquals([similar.tone, similar.after], [
    "attention",
    ". The name and date of birth match.",
  ]);
  assertEquals(similar.notes, [
    "example.pdf is already saved for this patient, from the same lab and collection time. Saving adds this report as well.",
  ]);

  assertEquals(
    filingMessage({ patient: null, warnings: [], similarReport: null }).tone,
    "blocked",
  );
});
