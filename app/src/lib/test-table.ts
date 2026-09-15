/**
 * The Tests section as a table: one row per test, one column per report, each
 * cell the result in the test's card unit, with its flag. It shows what a
 * heatmap would, without needing a chart library.
 */
import type { Dashboard } from "../../../desktop/contract.ts";
import { type Flag, toFlag } from "./flags.ts";
import { dayMonthYear } from "./format.ts";
import {
  byDate,
  display,
  type GridGroupName,
  rangeLabel,
  seriesByKey,
  type TestGroupData,
} from "./test-grid.ts";

export type TableColumn = { reportId: number; date: string; lab: string };

export type TableCell = {
  text: string;
  flag: Flag | null;
  /** That report's lab range, in the row's unit: labs' ranges can differ. */
  range: string | null;
};

export type TableRow = {
  key: string;
  name: string;
  unit: string | null;
  /** One per column; null when that report didn't include the test. */
  cells: (TableCell | null)[];
};

export type TestTable = {
  /** Reports with a result in any row, oldest first. */
  columns: TableColumn[];
  groups: { name: GridGroupName; rows: TableRow[] }[];
};

/**
 * A table of the given groups (already filtered by search). Flagged only keeps a
 * test flagged in any report: unlike a card, the table shows every result.
 */
export function buildTestTable(
  dashboard: Dashboard,
  groups: readonly TestGroupData[],
  filters: { flaggedOnly: boolean } = { flaggedOnly: false },
): TestTable {
  const series = seriesByKey(dashboard.results);
  const keys = new Set(
    groups.flatMap((group) => group.cards.map((c) => c.key)),
  );
  const reportIds = new Set(
    [...series].filter(([key]) => keys.has(key))
      .flatMap(([, results]) => results.map((r) => r.reportId)),
  );
  // Dashboard reports come newest first; the table reads left to right in time.
  const columns = dashboard.reports
    .filter((report) => reportIds.has(report.id))
    .toReversed()
    .map((report): TableColumn => ({
      reportId: report.id,
      date: dayMonthYear(report.collectedAt) ?? "No date",
      lab: report.providerName ?? "Unknown lab",
    }));

  const tableGroups = groups.map((group) => ({
    name: group.name,
    rows: group.cards.map((card): TableRow => {
      const readings = [...(series.get(card.key) ?? [])].sort(byDate);
      return {
        key: card.key,
        name: card.name,
        unit: card.unit,
        cells: columns.map((column): TableCell | null => {
          const reading = readings.findLast((r) =>
            r.reportId === column.reportId
          );
          return reading
            ? {
              text: display(reading),
              flag: toFlag(reading.flag),
              range: rangeLabel(reading),
            }
            : null;
        }),
      };
    }),
  }));

  return {
    columns,
    groups: tableGroups
      .map((group) => ({
        ...group,
        rows: filters.flaggedOnly
          ? group.rows.filter((row) => row.cells.some((cell) => cell?.flag))
          : group.rows,
      }))
      .filter((group) => group.rows.length > 0),
  };
}
