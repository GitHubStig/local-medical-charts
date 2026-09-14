/**
 * What the patient summary and Reports section show, worked out from a
 * Dashboard. Plain functions, tested in desktop/dashboard_test.ts.
 */
import type {
  Dashboard,
  DashboardReport,
  ReportWithoutPages,
} from "../../../desktop/contract.ts";
import {
  ageOn,
  dateAndTime,
  dayMonthYear,
  displayName,
  displaySex,
  monthSpan,
  plural,
  timestamp,
} from "./format.ts";

export type PatientOverview = {
  name: string;
  /** "Female · 41" */
  sexAndAge: string | null;
  idNumber: string | null;
  /** "4 reports · Nov 2024 – Mar 2026", or "1 report · 7 Aug 2026" */
  reports: string;
  /** "2 labs", or the lab's name when there's only one. */
  labs: string | null;
  latest: { date: string | null; flagged: number } | null;
  /** Only one report so far: the charts can't show a trend yet. */
  singleReport: boolean;
};

export function flaggedCount(report: ReportWithoutPages): number {
  return report.tests.filter((t) => t.flag !== null).length;
}

export function patientOverview(
  dashboard: Dashboard,
  today: Date,
): PatientOverview {
  const { patient } = dashboard;
  const usable = dashboard.reports.filter((r) => r.status === "ok" && r.report);
  const age = ageOn(patient.dateOfBirth, today);
  const sexAndAge = [displaySex(patient.sex), age === null ? null : String(age)]
    .filter(Boolean).join(" · ") || null;
  // One report shows its date; several show the months they span.
  const when = patient.reportCount === 1
    ? dayMonthYear(patient.firstCollectedAt)
    : monthSpan(patient.firstCollectedAt, patient.lastCollectedAt);
  const labs = new Set(
    usable.flatMap((r) => r.providerName ? [r.providerName] : []),
  );
  const newest = usable[0];

  return {
    name: displayName(patient.name),
    sexAndAge,
    idNumber: patient.idNumber,
    reports: [plural(patient.reportCount, "report"), when].filter(Boolean)
      .join(" · "),
    // One lab is named; several are counted.
    labs: labs.size === 1
      ? [...labs][0]
      : labs.size
      ? plural(labs.size, "lab")
      : null,
    latest: newest
      ? {
        date: dayMonthYear(newest.collectedAt),
        flagged: flaggedCount(newest.report!),
      }
      : null,
    singleReport: patient.reportCount === 1,
  };
}

export type ReportRow = {
  id: number;
  date: string;
  lab: string;
  resultCount: number;
  flagged: number;
  specimenNotes: string[];
  failed: boolean;
  error: string | null;
};

export function reportRow(entry: DashboardReport): ReportRow {
  const report = entry.status === "ok" ? entry.report : null;
  return {
    id: entry.id,
    date: dayMonthYear(entry.collectedAt) ?? "No date",
    lab: entry.providerName ?? "Unknown lab",
    resultCount: report?.tests.length ?? 0,
    flagged: report ? flaggedCount(report) : 0,
    specimenNotes: report?.specimenNotes ?? [],
    failed: entry.status === "failed",
    error: entry.error,
  };
}

export const DATE_LABELS = {
  collected: "Collected",
  received: "Received",
  requested: "Requested",
  reported: "Reported",
} as const;

export type ReportDetails = {
  provider: string[];
  doctor: string[];
  dates: string[];
  extraction: string[];
  referenceNumbers: { label: string; value: string }[];
  interpretation: { page: number; lines: string[] }[];
  /** OCR warnings from the report, plus results the catalog couldn't match. */
  notes: string[];
};

export function reportDetails(
  entry: DashboardReport,
  report: ReportWithoutPages,
  timeZone?: string,
): ReportDetails {
  const { provider, doctor, source } = report;
  const lines = (...values: (string | null)[]) =>
    values.filter((v): v is string => !!v);

  const collected = report.collectedAtSource && report.collectedAt
    ? `${DATE_LABELS[report.collectedAtSource]} ${
      dateAndTime(report.collectedAt)
    }`
    : null;
  const reported = report.collectedAtSource !== "reported" && report.reportedAt
    ? `Reported ${dateAndTime(report.reportedAt)}`
    : null;

  return {
    provider: lines(
      provider.name,
      provider.address,
      provider.phone,
      provider.website,
    ),
    doctor: lines(
      doctor.name ? displayName(doctor.name) : null,
      doctor.clinic ? displayName(doctor.clinic) : null,
    ),
    dates: lines(collected, reported),
    extraction: lines(
      source.model,
      `prompt ${source.promptHash}`,
      `catalog ${source.catalogHash}`,
      [timestamp(source.extractedAt, timeZone), plural(source.pages, "page")]
        .filter(Boolean).join(" · "),
      entry.fileName,
    ),
    referenceNumbers: report.headerFields,
    // The pipeline joins a block's printed lines with "; ".
    interpretation: report.interpretation.map((block) => ({
      page: block.page,
      lines: block.text.split(/;\s+/).filter(Boolean),
    })),
    notes: [
      ...report.warnings,
      ...report.unmapped.map((u) =>
        `Not in the catalog: ${u.name}${u.unit ? ` (${u.unit})` : ""}`
      ),
    ],
  };
}
