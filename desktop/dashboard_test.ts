import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import {
  patientOverview,
  reportDetails,
  reportRow,
} from "../app/src/lib/dashboard.ts";
import type { DashboardReport } from "./contract.ts";

// Uses the fictional sample reports (samples/).

async function sampleDashboard(name: string) {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const patient = (await b.listPatients()).find((p) => p.name === name)!;
  return (await b.getDashboard(patient.id))!;
}

Deno.test("the patient overview summarises every report", async () => {
  const overview = patientOverview(
    await sampleDashboard("ALEX TAN"),
    new Date(2026, 8, 14),
  );
  assertEquals(overview, {
    name: "Alex Tan",
    sexAndAge: "Female · 41",
    idNumber: "S1234482K",
    reports: "4 reports · Nov 2024 – Mar 2026",
    labs: "2 labs",
    latest: { date: "18 Mar 2026", flagged: 3 },
    singleReport: false,
  });
});

Deno.test("a single report reads naturally", async () => {
  const overview = patientOverview(
    await sampleDashboard("SAM RIVERA"),
    new Date(2026, 8, 14),
  );
  assertEquals(
    [
      overview.sexAndAge,
      overview.reports,
      overview.labs,
      overview.singleReport,
    ],
    ["Male · 36", "1 report · 7 Aug 2026", "Northside Pathology", true],
  );
});

Deno.test("report rows list newest first with counts and specimen notes", async () => {
  const rows = (await sampleDashboard("ALEX TAN")).reports.map(reportRow);
  assertEquals(
    rows.map((r) => [r.date, r.lab, r.resultCount, r.flagged, r.specimenNotes]),
    [
      ["18 Mar 2026", "Harbour Medical Lab", 26, 3, ["Specimen type Fasting"]],
      ["3 Oct 2025", "Harbour Medical Lab", 26, 3, [
        "Specimen Comment: Haemolysis +",
      ]],
      ["20 May 2025", "Northside Pathology", 25, 0, []],
      ["12 Nov 2024", "Northside Pathology", 25, 2, ["Comment: Fasting"]],
    ],
  );
});

Deno.test("report details show where each date came from", async () => {
  const [harbour, , , northside] = (await sampleDashboard("ALEX TAN")).reports;
  const h = reportDetails(harbour, harbour.report!, "UTC");
  assertEquals(h.provider, [
    "Harbour Medical Lab",
    "14 Wharf Street, Port Ellery",
    "(03) 5550 0192",
    "harbour-medical.example",
  ]);
  assertEquals(h.doctor, ["Dr Priya Nair", "Riverside Family Clinic"]);
  assertEquals(h.dates, [
    "Collected 18 Mar 2026, 08:40",
    "Reported 19 Mar 2026, 16:05",
  ]);
  assertEquals(h.extraction, [
    "sample-data",
    "prompt sample-data",
    `catalog ${harbour.report!.source.catalogHash}`,
    "19 Mar 2026, 21:14 · 2 pages",
    "alex-tan-2026-03-18.json",
  ]);
  // Two blocks printed on page 2, under one heading: the HbA1c ranges (three
  // lines) and a note to read HbA1c with glucose.
  assertEquals(h.interpretation.map((p) => [p.page, p.lines.length]), [[2, 4]]);
  assertEquals(h.notes, []);

  const n = reportDetails(northside, northside.report!, "UTC");
  assertEquals(n.dates[0], "Received 12 Nov 2024, 08:40");
  assertEquals(n.doctor, ["Dr Priya Nair", "Riverside Family Clinic"]);
  assertEquals(n.referenceNumbers.map((f) => f.label), ["R/N", "VN/AN"]);
});

Deno.test("interpretation notes printed on the same page sit under one page heading", async () => {
  const [harbour] = (await sampleDashboard("ALEX TAN")).reports;
  // Fictional blocks: two printed on page 2, one on page 3.
  const report = {
    ...harbour.report!,
    interpretation: [
      { page: 2, text: "Normal < 5.7%; Prediabetes 5.7 - 6.2%" },
      { page: 2, text: "Diabetes >= 6.3%" },
      { page: 3, text: "Fasting sample" },
    ],
  };
  assertEquals(reportDetails(harbour, report, "UTC").interpretation, [
    {
      page: 2,
      lines: ["Normal < 5.7%", "Prediabetes 5.7 - 6.2%", "Diabetes >= 6.3%"],
    },
    { page: 3, lines: ["Fasting sample"] },
  ]);
});

Deno.test("a report whose upgrade failed is listed with its reason", () => {
  const failed: DashboardReport = {
    id: 9,
    patientId: 1,
    fileName: "old.json",
    collectedAt: "2025-01-14T08:30:00",
    providerName: "Example Lab",
    status: "failed",
    error: "made by a newer version of the app",
    schemaVersion: 1,
    catalogHash: "x",
    importedAt: "2026-01-01T00:00:00.000Z",
    upgradedAt: "2026-01-01T00:00:00.000Z",
    report: null,
  };
  assertEquals(reportRow(failed), {
    id: 9,
    date: "14 Jan 2025",
    lab: "Example Lab",
    resultCount: 0,
    flagged: 0,
    specimenNotes: [],
    failed: true,
    error: "made by a newer version of the app",
  });
});
