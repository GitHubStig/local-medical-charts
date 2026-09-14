/**
 * Axes for the large chart, worked out once so every backend labels the same
 * ticks: a value scale on round numbers, the date and lab under each reading,
 * and the latest lab range written at the right edge beside its band. Readable
 * without hovering, which touch screens can't do.
 */
import { dayMonthYear } from "../format.ts";
import { dateMs, type Series } from "../series.ts";

/** Space around the plot for the labels, in pixels. */
export const AXIS_MARGIN = { top: 12, right: 72, bottom: 44, left: 48 };

/** Room a two-line date and lab label needs; closer readings are thinned out. */
const X_LABEL_WIDTH = 110;

export type XTick = {
  /** Milliseconds, as plotted. */
  value: number;
  /** Date on the first line, lab on the second. */
  lines: [string, string];
};

export type ChartAxes = {
  /** The series' value window widened to round numbers, and the ticks on it. */
  y: { domain: [number, number]; ticks: number[]; step: number };
  x: { ticks: XTick[] };
  /** The latest lab range, placed at the middle of its band. */
  rangeLabel: { text: string; y: number } | null;
};

const tidy = (value: number) => Number(value.toPrecision(12));

/** A 1, 2 or 5 step (times a power of ten) giving about four intervals. */
function niceStep(span: number): number {
  const raw = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const multiple = [1, 2, 5, 10].find((m) => m * magnitude >= raw) ?? 10;
  return tidy(multiple * magnitude);
}

/** Up to `room` readings, evenly spread and always including the latest. */
function spread<T>(items: readonly T[], room: number): T[] {
  if (items.length <= room) return [...items];
  if (room <= 1) return [items[items.length - 1]];
  const indexes = new Set(
    Array.from(
      { length: room },
      (_, i) => Math.round((i * (items.length - 1)) / (room - 1)),
    ),
  );
  return [...indexes].map((i) => items[i]);
}

export function chartAxes(series: Series, plotWidth: number): ChartAxes | null {
  const domain = series.domain;
  if (!domain) return null;

  const [low, high] = domain.y;
  const step = niceStep(high - low || Math.abs(high) || 1);
  const bottom = tidy(Math.floor(low / step) * step);
  const top = tidy(Math.ceil(high / step) * step);
  const ticks: number[] = [];
  for (let i = 0; tidy(bottom + i * step) <= top; i++) {
    ticks.push(tidy(bottom + i * step));
  }

  // One label per day: two reports on the same day would print over each other.
  const days = new Set<string>();
  const readings = series.points.filter((point) => {
    const day = point.date.slice(0, 10);
    if (days.has(day)) return false;
    days.add(day);
    return true;
  });
  const room = Math.max(1, Math.floor(plotWidth / X_LABEL_WIDTH));
  const xTicks = spread(readings, room).map((point): XTick => ({
    value: dateMs(point.date),
    lines: [dayMonthYear(point.date) ?? "", point.lab],
  }));

  // Only a band that reaches the right edge belongs to the latest reading.
  const latest = series.points.at(-1);
  const band = series.bands.at(-1);
  const rangeLabel = latest?.range && band && band.end === domain.x[1]
    ? {
      text: latest.range,
      y: tidy(((band.min ?? bottom) + (band.max ?? top)) / 2),
    }
    : null;

  return {
    y: { domain: [bottom, top], ticks, step },
    x: { ticks: xTicks },
    rangeLabel,
  };
}
