import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import {
  buildTextResults,
  filterTextRows,
} from "../app/src/lib/text-results.ts";
import type { Dashboard, DashboardReport, StoredResult } from "./contract.ts";

// Uses the fictional sample reports (samples/).

async function sampleDashboard(name: string): Promise<Dashboard> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const patient = (await b.listPatients()).find((p) => p.name === name)!;
  return (await b.getDashboard(patient.id))!;
}

Deno.test("text results have a column per report, oldest first, and a row per word-only test", async () => {
  const { columns, rows } = buildTextResults(await sampleDashboard("ALEX TAN"));
  assertEquals(columns.map((c) => [c.date, c.lab]), [
    ["12 Nov 2024", "Northside Pathology"],
    ["20 May 2025", "Northside Pathology"],
    ["3 Oct 2025", "Harbour Medical Lab"],
    ["18 Mar 2026", "Harbour Medical Lab"],
  ]);
  assertEquals(
    rows.map((r) => [r.key, r.group, r.expected]),
    [
      ["urine_transparency", "Urinalysis", null],
      ["urine_colour", "Urinalysis", null],
      ["urine_leucocytes", "Urinalysis", "Negative"],
      ["urine_blood", "Urinalysis", "Negative"],
      ["urine_protein", "Urinalysis", "Negative"],
      ["urine_glucose", "Urinalysis", "Negative"],
    ],
  );

  // One lab prints "Clarity", the other "Transparency": one row either way.
  const clarity = rows[0];
  assertEquals(clarity.name, "Urine transparency");
  assertEquals(clarity.cells.map((c) => c?.text), [
    "Clear",
    "Clear",
    "Slightly Cloudy",
    "Clear",
  ]);

  const blood = rows[3];
  assertEquals(blood.cells.map((c) => c && [c.text, c.flag]), [
    ["Negative", null],
    ["Negative", null],
    ["Trace", "A"],
    ["Negative", null],
  ]);
  assertEquals(rows.map((r) => r.flagged), [
    false,
    false,
    false,
    true,
    false,
    false,
  ]);
});

Deno.test("a patient without word-only results has an empty table", async () => {
  assertEquals(buildTextResults(await sampleDashboard("SAM RIVERA")), {
    columns: [],
    rows: [],
  });
});

Deno.test("search matches names, printed names and groups; flagged-only keeps rows flagged in any report", async () => {
  const { rows } = buildTextResults(await sampleDashboard("ALEX TAN"));
  const keys = (query: string, flaggedOnly = false) =>
    filterTextRows(rows, { query, flaggedOnly }).map((r) => r.key);

  assertEquals(keys("blood"), ["urine_blood"]);
  assertEquals(keys("clarity"), ["urine_transparency"]);
  assertEquals(keys("URINALYSIS").length, 6);
  assertEquals(keys("", true), ["urine_blood"]);
  assertEquals(keys("protein", true), []);
});

const report = (id: number, collectedAt: string): DashboardReport => ({
  id,
  patientId: 1,
  fileName: `report-${id}.json`,
  collectedAt,
  providerName: null,
  status: "ok",
  error: null,
  schemaVersion: 1,
  catalogHash: "test",
  importedAt: collectedAt,
  upgradedAt: collectedAt,
  report: null,
});

const result = (
  reportId: number,
  collectedAt: string,
  fields: Partial<StoredResult>,
): StoredResult => ({
  reportId,
  position: 0,
  analyte: null,
  specimen: "urine",
  name: "Mystery Crystals",
  collectedAt,
  resultKind: "text",
  value: null,
  op: null,
  text: "Absent",
  unit: null,
  standardValue: null,
  standardOp: null,
  standardUnit: null,
  range: null,
  flag: null,
  flagSource: null,
  page: 1,
  ...fields,
});

Deno.test("reports missing a test leave a gap; tests with any number stay in the grid", () => {
  const march = "2026-03-01T09:00:00", may = "2026-05-01T09:00:00";
  const dashboard = {
    patient: {} as Dashboard["patient"],
    reports: [report(2, may), report(1, march)],
    results: [
      result(1, march, { range: { kind: "text", text: "Absent or few" } }),
      result(2, may, { name: "Casts", text: "Hyaline casts seen" }),
      // Numeric in one report and words in another: charted, not tabled.
      result(1, march, { name: "Urine pH", analyte: "urine_ph", text: "High" }),
      result(2, may, {
        name: "Urine pH",
        analyte: "urine_ph",
        resultKind: "numeric",
        value: 6,
        text: null,
      }),
    ],
  } satisfies Dashboard;

  const { columns, rows } = buildTextResults(dashboard);
  assertEquals(columns.map((c) => [c.reportId, c.date, c.lab]), [
    [1, "1 Mar 2026", "Unknown lab"],
    [2, "1 May 2026", "Unknown lab"],
  ]);
  assertEquals(
    rows.map((
      r,
    ) => [r.name, r.group, r.expected, r.cells.map((c) => c?.text ?? null)]),
    [
      ["Casts", "Not in the catalog", null, [null, "Hyaline casts seen"]],
      ["Mystery Crystals", "Not in the catalog", "Absent or few", [
        "Absent",
        null,
      ]],
    ],
  );
});
