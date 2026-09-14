/**
 * What the floating card says after reports are added: a title, a line for each
 * file, and whether it may close by itself. Plain functions, tested in
 * desktop/import-toast_test.ts.
 */
import type { ImportOutcome } from "../../../desktop/contract.ts";
import { dayMonthYear, displayName, plural } from "./format.ts";
import { describeImport, summarizeImport } from "./import-files.ts";

export type ToastRow = {
  key: string;
  tone: "added" | "duplicate" | "rejected";
  fileName: string;
  /** "Alex Tan · 20 May 2025 · Harbour Medical Lab · 14 results", or why it wasn't imported. */
  detail: string;
  warnings: string[];
};

export type ImportToast = {
  title: string;
  rows: ToastRow[];
  /** Stays until closed: a file couldn't be imported, or one needs a second look. */
  sticky: boolean;
};

export function importToast(outcomes: readonly ImportOutcome[]): ImportToast {
  const summary = summarizeImport(outcomes);
  const all = (count: number) => count === outcomes.length;
  const title = all(summary.added)
    ? `${plural(summary.added, "report")} added`
    : all(summary.duplicates)
    ? summary.duplicates === 1
      ? "Already imported"
      : `${summary.duplicates} reports were already imported`
    : all(summary.rejected)
    ? summary.rejected === 1
      ? "Couldn't import the file"
      : `Couldn't import ${summary.rejected} files`
    : describeImport(summary);

  const rows = outcomes.map((outcome, index): ToastRow => {
    if (outcome.status === "rejected") {
      return {
        key: String(index),
        tone: "rejected",
        fileName: outcome.fileName,
        detail: outcome.error,
        warnings: [],
      };
    }
    const filed = outcome.summary;
    return {
      key: String(index),
      tone: outcome.status,
      fileName: outcome.fileName,
      detail: [
        outcome.status === "duplicate" ? "Already imported" : null,
        filed.patientName ? displayName(filed.patientName) : null,
        dayMonthYear(filed.collectedAt),
        filed.providerName,
        plural(filed.resultCount, "result"),
      ].filter(Boolean).join(" · "),
      warnings: outcome.warnings,
    };
  });

  return {
    title,
    rows,
    sticky: summary.rejected > 0 || summary.warnings > 0,
  };
}
