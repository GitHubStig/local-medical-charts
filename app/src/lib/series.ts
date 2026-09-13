/**
 * Chart series: one per charted test, every reading in the catalog's unit, and
 * the lab's reference range as bands that step where the range changes. Nothing
 * here knows about a chart library; each backend draws from a Series. Plain
 * functions, tested in desktop/series_test.ts.
 */
import type {
  Dashboard,
  DashboardReport,
  StoredResult,
} from "../../../desktop/contract.ts";
import { unitFactor } from "./analytes.ts";
import { type Flag, toFlag } from "./flags.ts";
import {
  byDate,
  describeTest,
  type GridGroupName,
  isTextOnly,
  rangeLabel,
  seriesByKey,
} from "./test-grid.ts";

export type Comparator = "<" | "<=" | ">" | ">=";

export type SeriesPoint = {
  reportId: number;
  /** When the sample was collected, as the report gave it (lab wall-clock time). */
  date: string;
  /** In the series' unit. A comparator result plots at its bound: "< 5" at 5. */
  value: number;
  op: Comparator | null;
  flag: Flag | null;
  lab: string;
  /** Exactly as the report printed it, for the readings table. */
  printed: {
    name: string;
    value: string;
    unit: string | null;
    range: string | null;
  };
  /** The lab range in the series' unit ("< 35", "0 – 40"), or its text when banded. */
  range: string | null;
  specimenNotes: string[];
};

/**
 * A stretch of the time axis where one lab range applied, in the series' unit.
 * A null bound is open: the band runs to the edge of the chart.
 */
export type RangeBand = {
  start: string;
  end: string;
  min: number | null;
  max: number | null;
};

export type Series = {
  /** Same key as the test's card in the grid. */
  key: string;
  name: string;
  group: GridGroupName;
  unit: string | null;
  /** Oldest first. */
  points: SeriesPoint[];
  bands: RangeBand[];
  /** No band to draw, but a lab printed a banded or conditional range (e.g. HbA1c cut-offs). */
  bandedRange: boolean;
  /** Readings that can't go on a time axis, and why. */
  unplotted: { reportId: number; reason: string }[];
  /** Axis extents with some padding, shared by every backend; null without points. */
  domain: { x: [string, string]; y: [number, number] } | null;
};

const DAY = 24 * 60 * 60 * 1000;
/** Either side of a lone reading, so one report still draws a readable band. */
const LONE_READING_PADDING = 30 * DAY;

/**
 * Report dates carry no time zone: they're the lab's wall-clock time. Doing the
 * arithmetic in UTC keeps them exactly as printed, wherever the app runs.
 */
export function dateMs(date: string): number {
  const m = date.match(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2})?)?/);
  return m ? Date.parse(`${m[1]}${m[2] ?? "T00:00"}Z`) : NaN;
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

function midpoint(a: string, b: string): string {
  return fromMs((dateMs(a) + dateMs(b)) / 2);
}

function isComparator(op: string | null): op is Comparator {
  return op === "<" || op === "<=" || op === ">" || op === ">=";
}

/** The reading's range as numbers in the series' unit; null when it isn't a plain range. */
function bandLimits(
  result: StoredResult,
): { min: number | null; max: number | null } | null {
  const range = result.range;
  if (!range) return null;
  const factor = result.analyte ? unitFactor(result.analyte, result.unit) : 1;
  if (factor === null) return null;
  const n = (v: number) => Number((v * factor).toPrecision(12));
  switch (range.kind) {
    case "between":
      return { min: n(range.min), max: n(range.max) };
    case "below":
      return { min: null, max: n(range.limit) };
    case "above":
      return { min: n(range.limit), max: null };
    default:
      return null;
  }
}

function printedFallback(result: StoredResult): string {
  if (result.resultKind === "text") return result.text ?? "";
  return `${result.op ?? ""}${result.value ?? ""}`;
}

function buildOne(
  key: string,
  results: readonly StoredResult[],
  reports: ReadonlyMap<number, DashboardReport>,
): Series {
  const readings = [...results].sort(byDate);
  const { info, name, group, latest } = describeTest(readings);
  const unit = info ? info.unit || null : latest.unit;

  const points: SeriesPoint[] = [];
  const limits: ({ min: number | null; max: number | null } | null)[] = [];
  const unplotted: Series["unplotted"] = [];
  for (const result of readings) {
    const value = info ? result.standardValue : result.value;
    const op = info ? result.standardOp : result.op;
    if (result.resultKind === "text") {
      unplotted.push({
        reportId: result.reportId,
        reason: `Reported as words: ${result.text ?? ""}`,
      });
      continue;
    }
    if (
      result.collectedAt === null || Number.isNaN(dateMs(result.collectedAt))
    ) {
      unplotted.push({
        reportId: result.reportId,
        reason: "No collection date",
      });
      continue;
    }
    if (value === null) {
      unplotted.push({
        reportId: result.reportId,
        reason: `No conversion from ${result.unit ?? "no unit"} to ${
          unit ?? "no unit"
        }`,
      });
      continue;
    }

    const entry = reports.get(result.reportId);
    const test = entry?.report?.tests[result.position];
    points.push({
      reportId: result.reportId,
      date: result.collectedAt,
      value,
      op: isComparator(op) ? op : null,
      flag: toFlag(result.flag),
      lab: entry?.providerName ?? "Unknown lab",
      printed: {
        name: result.name,
        value: test?.printed.value ?? printedFallback(result),
        unit: test?.printed.unit ?? result.unit,
        range: test?.printed.referenceText ?? null,
      },
      range: result.range?.kind === "text"
        ? result.range.text
        : rangeLabel(result),
      specimenNotes: entry?.report?.specimenNotes ?? [],
    });
    limits.push(bandLimits(result));
  }

  const domain = points.length ? axisDomain(points, limits) : null;
  return {
    key,
    name,
    group,
    unit,
    points,
    bands: domain ? steppedBands(points, limits, domain.x) : [],
    bandedRange: limits.every((l) => l === null) &&
      readings.some((r) => r.range?.kind === "text"),
    unplotted,
    domain,
  };
}

/**
 * Each reading's band reaches halfway to its neighbours, so every point sits
 * inside its own lab's range; the first and last run to the chart's edges.
 * Neighbours with the same limits merge; readings without a range leave a gap.
 */
function steppedBands(
  points: readonly SeriesPoint[],
  limits: readonly ({ min: number | null; max: number | null } | null)[],
  [first, last]: [string, string],
): RangeBand[] {
  const bands: RangeBand[] = [];
  points.forEach((point, i) => {
    const own = limits[i];
    if (!own) return;
    const start = i === 0 ? first : midpoint(points[i - 1].date, point.date);
    const end = i === points.length - 1
      ? last
      : midpoint(point.date, points[i + 1].date);
    const previous = bands.at(-1);
    if (
      previous && limits[i - 1] && previous.end === start &&
      previous.min === own.min && previous.max === own.max
    ) {
      previous.end = end;
    } else {
      bands.push({ start, end, min: own.min, max: own.max });
    }
  });
  return bands;
}

function axisDomain(
  points: readonly SeriesPoint[],
  limits: readonly ({ min: number | null; max: number | null } | null)[],
): NonNullable<Series["domain"]> {
  const times = points.map((p) => dateMs(p.date));
  const earliest = Math.min(...times), latest = Math.max(...times);
  const padX = latest === earliest
    ? LONE_READING_PADDING
    : (latest - earliest) * 0.05;

  const values = [
    ...points.map((p) => p.value),
    ...limits.flatMap((l) => l ? [l.min, l.max] : [])
      .filter((v): v is number => v !== null),
  ];
  const low = Math.min(...values), high = Math.max(...values);
  const padY = (high - low) * 0.1 || Math.abs(high) * 0.1 || 1;
  // Lab values are rarely negative; don't let padding invent a negative axis.
  const bottom = low >= 0 ? Math.max(0, low - padY) : low - padY;

  const tidy = (v: number) => Number(v.toPrecision(12));
  return {
    x: [fromMs(earliest - padX), fromMs(latest + padX)],
    y: [tidy(bottom), tidy(high + padY)],
  };
}

/** A series for every test with a card in the grid, by the card's key. */
export function buildSeries(dashboard: Dashboard): Map<string, Series> {
  const reports = new Map(dashboard.reports.map((r) => [r.id, r]));
  const series = new Map<string, Series>();
  for (const [key, results] of seriesByKey(dashboard.results)) {
    if (!isTextOnly(results)) {
      series.set(key, buildOne(key, results, reports));
    }
  }
  return series;
}
