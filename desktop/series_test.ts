import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { buildSeries } from "../app/src/lib/series.ts";
import { buildTestGrid } from "../app/src/lib/test-grid.ts";
import type { Dashboard, StoredResult } from "./contract.ts";

// Uses the fictional sample reports (samples/).

async function sampleDashboard(name: string): Promise<Dashboard> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const patient = (await b.listPatients()).find((p) => p.name === name)!;
  return (await b.getDashboard(patient.id))!;
}

Deno.test("there's a series for every card in the grid, under the card's key", async () => {
  const dashboard = await sampleDashboard("ALEX TAN");
  const cardKeys = buildTestGrid(dashboard).groups
    .flatMap((g) => g.cards.map((c) => c.key));
  assertEquals([...buildSeries(dashboard).keys()].sort(), cardKeys.sort());
});

Deno.test("readings plot in the catalog's unit and keep what the lab printed", async () => {
  const hb = buildSeries(await sampleDashboard("ALEX TAN")).get("haemoglobin")!;
  assertEquals([hb.name, hb.unit], ["Haemoglobin", "g/dL"]);
  assertEquals(hb.points.map((p) => [p.date, p.value, p.lab]), [
    ["2024-11-12T08:40:00", 12.5, "Northside Pathology"],
    ["2025-05-20T08:40:00", 12.2, "Northside Pathology"],
    ["2025-10-03T08:40:00", 11.7, "Harbour Medical Lab"],
    ["2026-03-18T08:40:00", 12.5, "Harbour Medical Lab"],
  ]);

  // Harbour prints g/L: 117 g/L with (120-155) is 11.7 g/dL against 12 – 15.5.
  const october = hb.points[2];
  assertEquals(october.printed, {
    name: "Haemoglobin",
    value: "117",
    unit: "g/L",
    range: "(120-155)",
  });
  assertEquals(
    [october.range, october.flag, october.op, october.specimenNotes],
    ["12 – 15.5", "L", null, ["Specimen Comment: Haemolysis +"]],
  );
});

Deno.test("the reference band steps halfway between readings where the lab's range changes", async () => {
  const hb = buildSeries(await sampleDashboard("ALEX TAN")).get("haemoglobin")!;
  assertEquals(hb.domain, {
    x: ["2024-10-18T19:28:00", "2026-04-11T21:52:00"],
    y: [11.05, 16.45],
  });
  assertEquals(hb.bands, [
    {
      start: "2024-10-18T19:28:00",
      end: "2025-07-27T08:40:00",
      min: 11.5,
      max: 16,
    },
    {
      start: "2025-07-27T08:40:00",
      end: "2026-04-11T21:52:00",
      min: 12,
      max: 15.5,
    },
  ]);
});

Deno.test("comparator results plot at their bound; single-sided ranges leave the band open", async () => {
  const series = buildSeries(await sampleDashboard("ALEX TAN"));

  const alt = series.get("alt")!;
  assertEquals(
    [alt.points[0].value, alt.points[0].op, alt.points[0].printed.value],
    [7, "<", "<7"],
  );
  assertEquals(alt.bands.map((b) => [b.min, b.max]), [[0, 40], [null, 35]]);
  assertEquals(alt.points.at(-1)!.flag, "H");
  assertEquals(alt.domain!.y[0], 0, "padding never takes the axis below zero");

  // Both labs print ≥ 60, in different unit spellings: one band throughout.
  const egfr = series.get("egfr")!;
  assertEquals([egfr.points[0].value, egfr.points[0].op], [60, ">="]);
  assertEquals(egfr.bands, [{
    start: egfr.domain!.x[0],
    end: egfr.domain!.x[1],
    min: 60,
    max: null,
  }]);
});

Deno.test("banded ranges draw no band; a lab that prints no range leaves a gap", async () => {
  const series = buildSeries(await sampleDashboard("ALEX TAN"));

  const hba1c = series.get("hba1c")!;
  assertEquals([hba1c.bandedRange, hba1c.bands], [true, []]);
  assertEquals(
    hba1c.points[0].range,
    "Normal <5.7%; Prediabetes 5.7-6.2%; Diabetes >=6.3%",
  );

  const neutrophils = series.get("neutrophils_pct")!;
  assertEquals(neutrophils.bandedRange, false);
  assertEquals(neutrophils.bands.map((b) => [b.end, b.min, b.max]), [
    ["2025-07-27T08:40:00", 40, 75],
  ]);
});

Deno.test("a lone reading gets a month either side, with its band across the whole window", async () => {
  const hb = buildSeries(await sampleDashboard("SAM RIVERA")).get(
    "haemoglobin",
  )!;
  assertEquals(hb.points.map((p) => p.date), ["2026-08-07T08:40:00"]);
  assertEquals(hb.domain!.x, ["2026-07-08T08:40:00", "2026-09-06T08:40:00"]);
  assertEquals(hb.bands, [{
    start: "2026-07-08T08:40:00",
    end: "2026-09-06T08:40:00",
    min: 11.5,
    max: 16,
  }]);
});

const result = (
  reportId: number,
  collectedAt: string | null,
  fields: Partial<StoredResult>,
): StoredResult => ({
  reportId,
  position: 0,
  analyte: null,
  specimen: "blood",
  name: "Mystery Marker",
  collectedAt,
  resultKind: "numeric",
  value: null,
  op: null,
  text: null,
  unit: "mmol/L",
  standardValue: null,
  standardOp: null,
  standardUnit: null,
  range: { kind: "between", min: 1, max: 5 },
  flag: null,
  flagSource: null,
  page: 1,
  ...fields,
});

Deno.test("readings without a date or a number are listed as unplotted, with the reason", () => {
  const dashboard = {
    patient: {} as Dashboard["patient"],
    // No report entries: lab and printed value fall back to the stored result.
    reports: [],
    results: [
      result(1, "2026-01-01T09:00:00", { value: 2 }),
      result(2, "2026-03-01T09:00:00", {
        resultKind: "text",
        text: "Haemolysed",
      }),
      result(3, null, { value: 3 }),
      result(4, "2026-05-01T09:00:00", {
        resultKind: "comparator",
        value: 4,
        op: "<",
      }),
    ],
  } satisfies Dashboard;

  const series = buildSeries(dashboard).get("unmatched:mystery marker|mmol/L")!;
  assertEquals([series.name, series.unit], ["Mystery Marker", "mmol/L"]);
  assertEquals(
    series.points.map((
      p,
    ) => [p.reportId, p.value, p.op, p.lab, p.printed.value]),
    [
      [1, 2, null, "Unknown lab", "2"],
      [4, 4, "<", "Unknown lab", "<4"],
    ],
  );
  assertEquals(series.unplotted, [
    { reportId: 3, reason: "No collection date" },
    { reportId: 2, reason: "Reported as words: Haemolysed" },
  ]);
  // The unplotted reading between them doesn't split the band.
  assertEquals(series.domain, {
    x: ["2025-12-26T09:00:00", "2026-05-07T09:00:00"],
    y: [0.6, 5.4],
  });
  assertEquals(series.bands, [{
    start: "2025-12-26T09:00:00",
    end: "2026-05-07T09:00:00",
    min: 1,
    max: 5,
  }]);
});
