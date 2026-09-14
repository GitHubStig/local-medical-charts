/**
 * What the zoomed view of one test shows: a header, and every reading as the
 * lab printed it and as it's charted. Plain functions, tested in
 * desktop/test-detail_test.ts.
 */
import type { DashboardReport } from "../../../desktop/contract.ts";
import { ANALYTES, unitFactor } from "./analytes.ts";
import type { Flag } from "./flags.ts";
import { dayMonthYear, formatMeasurement } from "./format.ts";
import type { Series } from "./series.ts";

export type DetailRow = {
  reportId: number;
  date: string;
  lab: string;
  /** Exactly as printed: "<5 IU/L". */
  printed: string;
  /** The test name the lab printed: "ALT (SGPT)". */
  printedName: string;
  /** In the series' unit, as charted: "< 5 U/L". */
  standard: string;
  range: string | null;
  flag: Flag | null;
  /** "Below reportable limit" for results like "< 5"; null otherwise. */
  bound: string | null;
  specimenNotes: string[];
};

export type TestDetail = {
  title: string;
  /** The spelled-out name when the title is an abbreviation: "Alanine Aminotransferase". */
  subtitle: string | null;
  /** "Liver · blood · U/L" */
  meta: string;
  latest: { value: string; date: string; flag: Flag | null } | null;
  /** Newest first. */
  rows: DetailRow[];
  /** Readings left off the chart: "3 Oct 2025 · Harbour Medical Lab: No collection date". */
  unplotted: string[];
  /** How the readings were matched and converted. */
  notes: string[];
};

const FACTOR = new Intl.NumberFormat("en", { maximumFractionDigits: 6 });

/** Short catalog names ("ALT", "eGFR") get their longest spelled-out alias. */
function spelledOut(key: string, title: string): string | null {
  const info = ANALYTES.get(key);
  if (!info || /\s/.test(title) || title.length > 6) return null;
  const candidates = info.aliases.filter((alias) =>
    /\s/.test(alias) && !alias.toLowerCase().includes(title.toLowerCase())
  );
  return candidates.toSorted((a, b) => b.length - a.length)[0] ?? null;
}

function boundText(op: string | null): string | null {
  if (op === "<" || op === "<=") return "Below reportable limit";
  if (op === ">" || op === ">=") return "Above reportable limit";
  return null;
}

/** "mL/min/1.73m²" and "ml/min/1.73m^2" are one unit spelled two ways. */
function sameSpelling(a: string, b: string): boolean {
  const letters = (unit: string) =>
    unit.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return letters(a) === letters(b);
}

/** Printed units that differ from the series' unit, and what that means for the numbers. */
function unitNotes(series: Series): string[] {
  const unit = series.unit;
  if (!ANALYTES.has(series.key) || !unit) return [];
  const printed = new Set(
    series.points.flatMap((p) => p.printed.unit ? [p.printed.unit] : []),
  );
  return [...printed]
    .filter((other) => !sameSpelling(other, unit))
    .flatMap((other) => {
      const factor = unitFactor(series.key, other);
      if (factor === null) return [];
      return [
        factor === 1
          ? `${other} and ${unit} are the same unit`
          : `${other} converted to ${unit} (× ${FACTOR.format(factor)})`,
      ];
    });
}

export function testDetail(
  series: Series,
  reports: readonly DashboardReport[],
): TestDetail {
  const byId = new Map(reports.map((report) => [report.id, report]));
  const latest = series.points.at(-1);

  return {
    title: series.name,
    subtitle: spelledOut(series.key, series.name),
    meta: [series.group, series.specimen, series.unit]
      .filter(Boolean).join(" · "),
    latest: latest
      ? {
        value: formatMeasurement(latest.value, latest.op, series.unit),
        date: dayMonthYear(latest.date) ?? "No date",
        flag: latest.flag,
      }
      : null,
    rows: series.points.toReversed().map((point) => ({
      reportId: point.reportId,
      date: dayMonthYear(point.date) ?? "No date",
      lab: point.lab,
      printed: [point.printed.value, point.printed.unit]
        .filter(Boolean).join(" "),
      printedName: point.printed.name,
      standard: formatMeasurement(point.value, point.op, series.unit),
      range: point.range,
      flag: point.flag,
      bound: boundText(point.op),
      specimenNotes: point.specimenNotes,
    })),
    unplotted: series.unplotted.map(({ reportId, reason }) => {
      const report = byId.get(reportId);
      const date = dayMonthYear(report?.collectedAt ?? null) ?? "Undated";
      return `${date} · ${report?.providerName ?? "Unknown lab"}: ${reason}`;
    }),
    notes: [
      ANALYTES.has(series.key)
        ? `Matched to catalog analyte ${series.key}`
        : "Not in the catalog: charted by its printed name and unit",
      ...unitNotes(series),
    ],
  };
}
