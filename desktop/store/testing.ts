/**
 * Synthetic reports for store tests. Every name, ID and value here is made up.
 */
import {
  type Catalog,
  type CatalogIndex,
  indexCatalog,
} from "../../src/catalog.ts";
import { buildReport } from "../../src/normalize.ts";
import type { PageExtraction, RawTest, Report } from "../../src/schema.ts";

const baseCatalog: Catalog = {
  analytes: [
    {
      id: "haemoglobin",
      name: "Haemoglobin",
      specimen: "blood",
      group: "Other",
      unit: "g/dL",
      aliases: ["Haemoglobin"],
      units: { "g/dL": 1, "g/L": 0.1 },
    },
    {
      id: "glucose",
      name: "Glucose",
      specimen: "blood",
      group: "Other",
      unit: "mmol/L",
      aliases: ["Glucose"],
      units: { "mmol/L": 1 },
    },
  ],
};

export const catalogV1: CatalogIndex = indexCatalog(baseCatalog, "catalog-v1");

/** catalogV1 plus ferritin, which catalogV1 leaves unmapped. */
export const catalogV2: CatalogIndex = indexCatalog({
  analytes: [
    ...baseCatalog.analytes,
    {
      id: "ferritin",
      name: "Ferritin",
      specimen: "blood",
      group: "Other",
      unit: "ng/mL",
      aliases: ["Serum Ferritin"],
      units: { "ng/mL": 1 },
    },
  ],
}, "catalog-v2");

const test = (
  name: string,
  value: string,
  unit: string,
  range: string,
): RawTest => ({
  headings: [],
  specimen: "blood",
  name,
  nameZh: null,
  measurements: [{ value, unit, referenceText: range, marker: null }],
  notes: [],
});

export type ReportOptions = {
  patientName?: string;
  idNumber?: string | null;
  dateOfBirth?: string | null;
  collected?: string;
  haemoglobin?: string;
  label?: string;
};

/** A one-page merged report as the pipeline would write it, serialized. */
export function syntheticReport(
  options: ReportOptions = {},
  catalog = catalogV1,
): string {
  const extraction: PageExtraction = {
    page: 1,
    pageCount: 1,
    provider: {
      name: "Example Lab",
      address: null,
      phone: null,
      website: null,
    },
    patient: {
      name: options.patientName ?? "ALEX EXAMPLE",
      idNumber: options.idNumber === undefined ? "X1234567" : options.idNumber,
      dateOfBirth: options.dateOfBirth === undefined
        ? "15/08/90"
        : options.dateOfBirth,
      sex: "Female",
      age: "35",
    },
    doctor: { name: "DR EXAMPLE", clinic: null },
    dates: {
      collected: options.collected ?? "14/01/25 08:30",
      received: null,
      requested: null,
      reported: null,
    },
    headerFields: [],
    tests: [
      test("Haemoglobin", options.haemoglobin ?? "13.1", "g/dL", "(12.0-15.5)"),
      test("Glucose", "5.2", "mmol/L", "(3.9-6.0)"),
      test("Serum Ferritin", "85", "ng/mL", "(15-150)"),
    ],
    continuationText: null,
    interpretation: [],
    specimenNotes: [],
    warnings: [],
  };
  const report: Report = buildReport(
    [{
      image: `${options.label ?? "example"}-1.jpg`,
      model: "test-model",
      promptHash: "test-prompt",
      extractedAt: "2025-01-15T10:00:00.000Z",
      extraction,
    }],
    {
      report: options.label ?? "example",
      catalogHash: catalog.hash,
      mergedAt: "2025-01-15T11:00:00.000Z",
    },
    catalog,
  );
  return JSON.stringify(report, null, 2);
}
