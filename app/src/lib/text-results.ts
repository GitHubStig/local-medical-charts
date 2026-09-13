/**
 * The text results table: tests whose results are only ever words (e.g. urine
 * dipstick), one row per test and one column per report. Plain functions,
 * tested in desktop/text-results_test.ts.
 */
import type { Dashboard, StoredResult } from "../../../desktop/contract.ts";
import { type Flag, toFlag } from "./flags.ts";
import { dayMonthYear } from "./format.ts";
import {
  byDate,
  describeTest,
  type GridGroupName,
  GROUP_ORDER,
  isTextOnly,
  matchesQuery,
  rangeLabel,
  seriesByKey,
} from "./test-grid.ts";

export type TextColumn = { reportId: number; date: string; lab: string };

export type TextCell = { text: string; flag: Flag | null };

export type TextRow = {
  key: string;
  name: string;
  group: GridGroupName;
  /** What the latest report expected, e.g. "Negative"; null when it printed nothing. */
  expected: string | null;
  /** One per column; null when that report didn't include the test. */
  cells: (TextCell | null)[];
  flagged: boolean;
  order: number;
  searchText: string;
};

export type TextResults = {
  /** Reports with at least one text result, oldest first. */
  columns: TextColumn[];
  rows: TextRow[];
};

function expected(result: StoredResult): string | null {
  return result.range?.kind === "text" ? result.range.text : rangeLabel(result);
}

export function buildTextResults(dashboard: Dashboard): TextResults {
  const series = [...seriesByKey(dashboard.results)]
    .filter(([, results]) => isTextOnly(results));
  const reportIds = new Set(
    series.flatMap(([, results]) => results.map((r) => r.reportId)),
  );
  // Dashboard reports come newest first.
  const columns = dashboard.reports
    .filter((report) => reportIds.has(report.id))
    .toReversed()
    .map((report): TextColumn => ({
      reportId: report.id,
      date: dayMonthYear(report.collectedAt) ?? "No date",
      lab: report.providerName ?? "Unknown lab",
    }));

  const rows = series.map(([key, results]): TextRow => {
    const readings = [...results].sort(byDate);
    const { latest, name, group, order, searchText } = describeTest(readings);
    const cells = columns.map((column): TextCell | null => {
      const reading = readings.find((r) => r.reportId === column.reportId);
      return reading
        ? { text: reading.text ?? "", flag: toFlag(reading.flag) }
        : null;
    });
    return {
      key,
      name,
      group,
      expected: expected(latest),
      cells,
      flagged: cells.some((cell) => cell?.flag),
      order,
      searchText,
    };
  });

  rows.sort((a, b) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
    a.order - b.order || a.name.localeCompare(b.name)
  );
  return { columns, rows };
}

/**
 * Rows matching every word of the query. Flagged-only keeps a row when any
 * report flagged it: a table shows every reading, not just the latest.
 */
export function filterTextRows(
  rows: readonly TextRow[],
  filters: { query: string; flaggedOnly: boolean },
): TextRow[] {
  return rows.filter((row) =>
    (!filters.flaggedOnly || row.flagged) &&
    matchesQuery(row.searchText, filters.query)
  );
}
