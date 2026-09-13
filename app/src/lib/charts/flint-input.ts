/**
 * A Series as Flint input: the same line chart for every backend. Flint lays
 * out and styles the line; each backend's overlay adds what Flint can't
 * express (reference bands, hollow markers for bounds, the shared axis window),
 * from the overlay data here.
 */
import type { ChartAssemblyInput } from "flint-chart/core";
import { FLAGS } from "../flags.ts";
import { dayMonthYear } from "../format.ts";
import { dateMs, type Series, type SeriesPoint } from "../series.ts";

export type ChartRow = {
  /** Milliseconds, reading the report's wall-clock time as UTC (see series.ts). */
  date: number;
  value: number;
  /** Whether the value is a bound ("< 5"), drawn as a hollow marker. */
  bound: boolean;
  flagged: boolean;
  /** One line of hover text: "18 Mar 2026 · 47 U/L · Harbour Medical Lab · High". */
  tooltip: string;
};

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const OPERATORS = { "<": "<", "<=": "≤", ">": ">", ">=": "≥" } as const;

function tooltip(point: SeriesPoint, unit: string | null): string {
  const value = [
    point.op ? `${OPERATORS[point.op]} ` : "",
    number.format(point.value),
    unit ? ` ${unit}` : "",
  ].join("");
  return [
    dayMonthYear(point.date),
    value,
    point.lab,
    point.flag ? FLAGS[point.flag].label : null,
  ].filter(Boolean).join(" · ");
}

export function chartRows(series: Series): ChartRow[] {
  return series.points.map((point) => ({
    date: dateMs(point.date),
    value: point.value,
    bound: point.op !== null,
    flagged: point.flag !== null,
    tooltip: tooltip(point, series.unit),
  }));
}

/** A reference band in chart terms: times in ms, open limits run to the window's edge. */
export type ChartBand = {
  start: number;
  end: number;
  low: number;
  high: number;
};

/** A band's real limit, drawn as a thin edge line. */
export type BandEdge = { start: number; end: number; value: number };

export function chartBands(series: Series): ChartBand[] {
  const [bottom, top] = series.domain?.y ?? [0, 0];
  return series.bands.map((band) => ({
    start: dateMs(band.start),
    end: dateMs(band.end),
    low: band.min ?? bottom,
    high: band.max ?? top,
  }));
}

export function bandEdges(series: Series): BandEdge[] {
  return series.bands.flatMap((band) =>
    [band.min, band.max].flatMap((value) =>
      value === null
        ? []
        : [{ start: dateMs(band.start), end: dateMs(band.end), value }]
    )
  );
}

export function flintInput(
  series: Series,
  size: { width: number; height: number },
): ChartAssemblyInput {
  return {
    data: { values: chartRows(series) },
    semantic_types: {
      date: "DateTime",
      value: { semanticType: "Quantity", unit: series.unit ?? undefined },
    },
    chart_spec: {
      chartType: "Line Chart",
      encodings: {
        x: { field: "date", type: "temporal" },
        y: { field: "value", type: "quantitative" },
      },
      canvasSize: size,
    },
    field_display_names: { date: "Collected", value: series.name },
  };
}
