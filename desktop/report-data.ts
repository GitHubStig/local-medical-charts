/**
 * Pure functions over reports, used by the SQLite store and by the page's
 * fake bindings in browser development, so both derive the same data.
 * No runtime imports: safe to bundle into the Vue app.
 */
import type { Report } from "../src/schema.ts";
import type { StoredResult } from "./types.ts";

export type ReportWithoutPages = Omit<Report, "pages">;

/**
 * The key reports are grouped under. The ID number is preferred; spaces,
 * dashes and case are ignored so the same ID printed differently still matches.
 */
export function patientIdentity(patient: Report["patient"]): string | null {
  const id = patient.idNumber?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (id) return `id:${id}`;
  const name = patient.name?.toUpperCase().replace(/\s+/g, " ").trim();
  if (name && patient.dateOfBirthIso) {
    return `name:${name}|${patient.dateOfBirthIso}`;
  }
  return null;
}

/** A report's results as flat rows, in the order they appear in the report. */
export function resultsFromReport(
  reportId: number,
  report: Report,
): StoredResult[] {
  return report.tests.map((test, position) => {
    const result = test.result;
    return {
      reportId,
      position,
      analyte: test.analyte,
      specimen: test.specimen,
      name: test.name,
      collectedAt: report.collectedAt,
      resultKind: result.kind,
      value: result.kind === "text" ? null : result.value,
      op: result.kind === "comparator" ? result.op : null,
      text: result.kind === "text" ? result.text : null,
      unit: test.unit,
      standardValue: test.standard?.value ?? null,
      standardOp: test.standard?.op ?? null,
      standardUnit: test.standard?.unit ?? null,
      range: test.range,
      flag: test.flag,
      flagSource: test.flagSource,
      page: test.page,
    };
  });
}

/** The page never needs the embedded OCR pages, which roughly double a report's size. */
export function withoutPages(report: Report): ReportWithoutPages {
  const { pages: _, ...rest } = report;
  return rest;
}
