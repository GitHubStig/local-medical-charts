/**
 * The test grid: one card per test, grouped by the catalog's dashboard groups,
 * with search and a flagged-only filter. Plain functions, tested in
 * desktop/test-grid_test.ts.
 */
import {
  ANALYTE_GROUPS,
  type AnalyteGroup,
} from "../../../src/analyte-groups.ts";
import type { Dashboard, StoredResult } from "../../../desktop/contract.ts";
import { ANALYTES, unitFactor } from "./analytes.ts";
import { type Flag, toFlag } from "./flags.ts";
import { dayMonthYear, monthSpan, monthYear, plural } from "./format.ts";

export const UNMATCHED_GROUP = "Not in the catalog";
export type GridGroupName = AnalyteGroup | typeof UNMATCHED_GROUP;

export type TestCardData = {
  /** Analyte id, or a key built from the printed name for unmatched tests. */
  key: string;
  name: string;
  group: GridGroupName;
  /** The unit values are shown in: the catalog's standard unit when matched. */
  unit: string | null;
  latest: {
    display: string;
    flag: Flag | null;
    collectedAt: string | null;
  };
  /** "+0.8 since Oct 2025", or null when there's nothing to compare. */
  change: string | null;
  /** Beside the value: the change, or how many results there are to compare. */
  note: string;
  readingCount: number;
  /** The months the readings span, or a lone reading's date. */
  span: string | null;
  /** The latest reading's lab range, converted to `unit`; null for banded ranges. */
  range: string | null;
  order: number;
  /** Lower-case text the search matches against. */
  searchText: string;
};

export type TestGroupData = {
  name: GridGroupName;
  cards: TestCardData[];
  flagged: number;
};

export type TestGrid = {
  groups: TestGroupData[];
  /** Tests whose results are only ever words (e.g. urine dipstick); they're listed elsewhere. */
  textOnlyCount: number;
};

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const OPERATORS: Record<string, string> = {
  ">=": "≥",
  "<=": "≤",
  "<": "<",
  ">": ">",
};

/** Value in the card's unit: converted for matched tests, as printed otherwise. */
function shownValue(result: StoredResult) {
  return result.analyte
    ? { value: result.standardValue, op: result.standardOp }
    : { value: result.value, op: result.op };
}

/** The value as a card shows it: in the card's unit, with any comparator. */
export function display(result: StoredResult): string {
  if (result.resultKind === "text") return result.text ?? "";
  const { value, op } = shownValue(result);
  if (value === null) return "";
  return op
    ? `${OPERATORS[op] ?? op} ${number.format(value)}`
    : number.format(value);
}

/** The factor between printed and shown units, so ranges line up with values. */
function factor(result: StoredResult): number {
  return result.analyte ? unitFactor(result.analyte, result.unit) ?? 1 : 1;
}

/** A structured range as text, its numbers multiplied by `factor`; null for banded ranges. */
export function formatRange(
  range: StoredResult["range"],
  factor = 1,
): string | null {
  if (!range) return null;
  // Rounded as the pipeline rounds values, so 0.1 × 155 reads 15.5.
  const n = (v: number) => number.format(Number((v * factor).toPrecision(12)));
  switch (range.kind) {
    case "between":
      return `${n(range.min)} – ${n(range.max)}`;
    case "below":
      return `${range.inclusive ? "≤" : "<"} ${n(range.limit)}`;
    case "above":
      return `${range.inclusive ? "≥" : ">"} ${n(range.limit)}`;
    case "qualitative":
      return range.expected;
    default:
      return null;
  }
}

export function rangeLabel(result: StoredResult): string | null {
  return formatRange(result.range, factor(result));
}

function change(
  latest: StoredResult,
  previous: StoredResult | undefined,
): string | null {
  if (!previous) return null;
  const a = shownValue(latest), b = shownValue(previous);
  if (
    latest.resultKind !== "numeric" || previous.resultKind !== "numeric" ||
    a.value === null || b.value === null
  ) return null;
  const since = monthYear(previous.collectedAt);
  const suffix = since ? ` since ${since}` : "";
  // Rounded to the shown precision, so 12.5 − 11.7 reads 0.8, not 0.8000000000000007.
  const delta = Number((a.value - b.value).toFixed(2));
  if (delta === 0) return `No change${suffix}`;
  return `${delta > 0 ? "+" : "−"}${number.format(Math.abs(delta))}${suffix}`;
}

/** What a card says beside a value there's nothing to compare with. */
function readingNote(count: number, reportCount: number): string {
  if (count > 1) return plural(count, "result");
  return reportCount === 1
    ? "1 result — add another report to see a trend"
    : "1 result";
}

/** Oldest first; results without a date sort before dated ones. */
export const byDate = (a: StoredResult, b: StoredResult) =>
  (a.collectedAt ?? "").localeCompare(b.collectedAt ?? "") ||
  a.reportId - b.reportId || a.position - b.position;

export const GROUP_ORDER: readonly GridGroupName[] = [
  ...ANALYTE_GROUPS,
  UNMATCHED_GROUP,
];

/** One series per test: by catalog analyte, or by printed name and unit when unmatched. */
export function seriesByKey(
  results: readonly StoredResult[],
): Map<string, StoredResult[]> {
  const series = new Map<string, StoredResult[]>();
  for (const result of results) {
    const key = result.analyte ??
      `unmatched:${result.name.toLowerCase()}|${result.unit ?? ""}`;
    series.set(key, [...(series.get(key) ?? []), result]);
  }
  return series;
}

/** Tests whose results are only ever words go in the text results table, not the grid. */
export const isTextOnly = (results: readonly StoredResult[]) =>
  results.every((r) => r.resultKind === "text");

/** A test's catalog name, group, order and search text, from its readings (oldest first). */
export function describeTest(readings: readonly StoredResult[]) {
  const latest = readings[readings.length - 1];
  const info = latest.analyte ? ANALYTES.get(latest.analyte) : undefined;
  const name = info?.name ?? latest.name;
  const group: GridGroupName = info?.group ?? UNMATCHED_GROUP;
  const printedNames = [...new Set(readings.map((r) => r.name))];
  return {
    latest,
    info,
    name,
    group,
    order: info?.order ?? Number.MAX_SAFE_INTEGER,
    searchText: [name, group, ...printedNames, ...(info?.aliases ?? [])]
      .join(" ").toLowerCase(),
  };
}

/** Whether every word of the query appears in the search text. */
export function matchesQuery(searchText: string, query: string): boolean {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
    .every((word) => searchText.includes(word));
}

export function buildTestGrid(dashboard: Dashboard): TestGrid {
  const series = seriesByKey(dashboard.results);

  const cards: TestCardData[] = [];
  let textOnlyCount = 0;
  for (const [key, results] of series) {
    if (isTextOnly(results)) {
      textOnlyCount++;
      continue;
    }
    const readings = [...results].sort(byDate);
    const { latest, info, name, group, order, searchText } = describeTest(
      readings,
    );
    const changeText = change(latest, readings[readings.length - 2]);

    cards.push({
      key,
      name,
      group,
      unit: (info ? info.unit : latest.unit) || null,
      latest: {
        display: display(latest),
        flag: toFlag(latest.flag),
        collectedAt: latest.collectedAt,
      },
      change: changeText,
      note: changeText ??
        readingNote(readings.length, dashboard.patient.reportCount),
      readingCount: readings.length,
      span: readings.length === 1
        ? dayMonthYear(latest.collectedAt)
        : monthSpan(readings[0].collectedAt, latest.collectedAt),
      range: rangeLabel(latest),
      order,
      searchText,
    });
  }

  const groups = GROUP_ORDER.flatMap((groupName): TestGroupData[] => {
    const inGroup = cards
      .filter((c) => c.group === groupName)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return inGroup.length
      ? [{
        name: groupName,
        cards: inGroup,
        flagged: inGroup.filter((c) => c.latest.flag).length,
      }]
      : [];
  });

  return { groups, textOnlyCount };
}

/** The filters in words, e.g. "“glu” · flagged only"; null when neither is on. */
export function describeFilters(
  filters: { query: string; flaggedOnly: boolean },
): string | null {
  const query = filters.query.trim();
  const parts = [
    query ? `“${query}”` : null,
    filters.flaggedOnly ? "flagged only" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Cards matching every word of the query (and flagged, if asked), in their groups. */
export function filterTestGrid(
  groups: readonly TestGroupData[],
  filters: { query: string; flaggedOnly: boolean },
): TestGroupData[] {
  return groups.flatMap((group) => {
    const cards = group.cards.filter((card) =>
      (!filters.flaggedOnly || card.latest.flag !== null) &&
      matchesQuery(card.searchText, filters.query)
    );
    return cards.length
      ? [{
        ...group,
        cards,
        flagged: cards.filter((c) => c.latest.flag).length,
      }]
      : [];
  });
}
