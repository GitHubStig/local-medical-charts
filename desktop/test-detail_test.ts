import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { buildSeries } from "../app/src/lib/series.ts";
import { testDetail } from "../app/src/lib/test-detail.ts";
import type { Dashboard, StoredResult } from "./contract.ts";

// Uses the fictional sample reports (samples/).

async function alexDetail(key: string) {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const alex = (await b.listPatients()).find((p) => p.name === "ALEX TAN")!;
  const dashboard = (await b.getDashboard(alex.id))!;
  return testDetail(buildSeries(dashboard).get(key)!, dashboard.reports);
}

Deno.test("the header names the test, where it belongs, and its latest reading", async () => {
  const alt = await alexDetail("alt");
  assertEquals(
    [alt.title, alt.subtitle, alt.meta],
    ["ALT", "Alanine Aminotransferase", "Liver · blood · U/L"],
  );
  assertEquals(alt.latest, { value: "47 U/L", date: "18 Mar 2026", flag: "H" });

  // Only abbreviations get a spelled-out subtitle.
  assertEquals((await alexDetail("haemoglobin")).subtitle, null);
  assertEquals(
    (await alexDetail("egfr")).subtitle,
    "Estimated Glomerular Filtration Rate",
  );
});

Deno.test("every reading is listed newest first, as printed and as charted", async () => {
  const alt = await alexDetail("alt");
  assertEquals(alt.rows.map((r) => [r.date, r.lab]), [
    ["18 Mar 2026", "Harbour Medical Lab"],
    ["3 Oct 2025", "Harbour Medical Lab"],
    ["20 May 2025", "Northside Pathology"],
    ["12 Nov 2024", "Northside Pathology"],
  ]);
  assertEquals(alt.rows[0], {
    reportId: alt.rows[0].reportId,
    date: "18 Mar 2026",
    lab: "Harbour Medical Lab",
    printed: "47 U/L",
    printedName: "ALT",
    standard: "47 U/L",
    range: "< 35",
    flag: "H",
    bound: null,
    specimenNotes: ["Specimen type Fasting"],
  });
  const first = alt.rows[3];
  assertEquals(
    [first.printed, first.printedName, first.standard, first.range],
    ["<5 IU/L", "ALT (SGPT)", "< 5 U/L", "0 – 40"],
  );
  assertEquals([first.flag, first.bound], [null, "Below reportable limit"]);

  const egfr = await alexDetail("egfr");
  assertEquals(
    [egfr.rows[3].standard, egfr.rows[3].bound],
    ["≥ 90 mL/min/1.73m²", "Above reportable limit"],
  );
});

Deno.test("notes say how readings were matched, and only real unit differences", async () => {
  assertEquals((await alexDetail("alt")).notes, [
    "Matched to catalog analyte alt",
    "IU/L and U/L are the same unit",
  ]);
  assertEquals((await alexDetail("haemoglobin")).notes, [
    "Matched to catalog analyte haemoglobin",
    "g/L converted to g/dL (× 0.1)",
  ]);
  // ml/min/1.73m^2 is only another spelling of mL/min/1.73m²: nothing to say.
  assertEquals((await alexDetail("egfr")).notes, [
    "Matched to catalog analyte egfr",
  ]);
});

const result = (
  reportId: number,
  collectedAt: string | null,
  fields: Partial<StoredResult>,
): StoredResult => ({
  reportId,
  position: 0,
  analyte: null,
  specimen: "urine",
  name: "Mystery Marker",
  collectedAt,
  resultKind: "numeric",
  value: 2,
  op: null,
  text: null,
  unit: "mmol/L",
  standardValue: null,
  standardOp: null,
  standardUnit: null,
  range: null,
  flag: null,
  flagSource: null,
  page: 1,
  ...fields,
});

Deno.test("readings that couldn't be charted are listed with their report and reason", () => {
  const dashboard = {
    patient: {} as Dashboard["patient"],
    reports: [],
    results: [
      result(1, "2026-01-01T09:00:00", {}),
      result(2, null, {}),
    ],
  } satisfies Dashboard;
  const series = buildSeries(dashboard).get("unmatched:mystery marker|mmol/L")!;
  const detail = testDetail(series, dashboard.reports);
  assertEquals(detail.meta, "Not in the catalog · urine · mmol/L");
  assertEquals(detail.unplotted, [
    "Undated · Unknown lab: No collection date",
  ]);
  assertEquals(detail.notes, [
    "Not in the catalog: charted by its printed name and unit",
  ]);
  assertEquals(detail.rows.map((r) => [r.date, r.printed]), [
    ["1 Jan 2026", "2 mmol/L"],
  ]);
});
