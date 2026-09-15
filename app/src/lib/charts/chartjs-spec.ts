/**
 * The Chart.js chart for a Series: Flint assembles the line chart, then an
 * overlay adds the reading markers, axes on the large chart, and a small
 * plugin that paints the lab's reference bands behind them. Only Chart.js
 * types are imported, so Deno tests can build the config without a canvas.
 */
import type { ChartConfiguration, Plugin, Scale } from "chart.js";
import { assembleChartjs } from "flint-chart/chartjs";
import type { ChartCurve } from "../../../../desktop/settings.ts";
import { dateMs, type Series } from "../series.ts";
import { AXIS_MARGIN, type ChartAxes, chartAxes } from "./axes.ts";
import {
  type BandEdge,
  bandEdges,
  type ChartBand,
  chartBands,
  chartRows,
  flintInput,
} from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

/** Room around a bare chart so markers at the edges aren't clipped. */
const PADDING = 6;
const MARKER_RADIUS = 4;
/** How close the pointer must be to a marker to show its hover text. */
const HOVER_RADIUS = 12;

const VALUE = new Intl.NumberFormat("en", { maximumFractionDigits: 6 });

/** A plotted reading, carrying its hover text. */
export type ChartjsPoint = { x: number; y: number; tooltip: string };

type PixelScale = { getPixelForValue(value: number): number };
type Area = { left: number; right: number; top: number; bottom: number };

/** Where the bands and their edge lines go, in canvas pixels, kept inside the plot area. */
export function bandGeometry(
  bands: readonly ChartBand[],
  edges: readonly BandEdge[],
  x: PixelScale,
  y: PixelScale,
  area: Area,
) {
  const px = (v: number) =>
    Math.min(area.right, Math.max(area.left, x.getPixelForValue(v)));
  const py = (v: number) =>
    Math.min(area.bottom, Math.max(area.top, y.getPixelForValue(v)));
  return {
    rects: bands.map((band) => {
      const left = px(band.start), right = px(band.end);
      const top = py(band.high), bottom = py(band.low);
      return { x: left, y: top, width: right - left, height: bottom - top };
    }),
    lines: edges.map((edge) => ({
      x1: px(edge.start),
      x2: px(edge.end),
      y: py(edge.value),
    })),
  };
}

/**
 * Paints the reference bands under the datasets (Chart.js has no band of its
 * own) and, on the large chart, the latest range's label past the right edge.
 */
function referenceBands(
  series: Series,
  palette: ChartPalette,
  window: [number, number],
  rangeLabel: ChartAxes["rangeLabel"],
): Plugin<"line"> {
  const bands = chartBands(series, window);
  const edges = bandEdges(series);
  return {
    id: "referenceBands",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const { rects, lines } = bandGeometry(
        bands,
        edges,
        scales.x,
        scales.y,
        chartArea,
      );
      ctx.save();
      ctx.fillStyle = palette.band;
      for (const r of rects) ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeStyle = palette.bandEdge;
      ctx.lineWidth = 1;
      for (const line of lines) {
        // Half-pixel offset keeps a 1px line crisp.
        const y = Math.round(line.y) + 0.5;
        ctx.beginPath();
        ctx.moveTo(line.x1, y);
        ctx.lineTo(line.x2, y);
        ctx.stroke();
      }
      ctx.restore();
    },
    afterDraw(chart) {
      if (!rangeLabel) return;
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      ctx.font = `11px ${palette.font}`;
      ctx.fillStyle = palette.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(
        rangeLabel.text,
        chartArea.right + 8,
        scales.y.getPixelForValue(rangeLabel.y),
      );
      ctx.restore();
    },
  };
}

type FlintChartjs = {
  data: { datasets: Record<string, unknown>[] };
  // deno-lint-ignore no-explicit-any
  options: { scales: { x: object; y: object }; plugins?: any };
};

/** `size` is the whole chart; with `axes`, the labels take their room from it. */
export function chartjsConfig(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
  axes = false,
  curve: ChartCurve = "smooth",
): ChartConfiguration<"line", ChartjsPoint[]> {
  const domain = series.domain;
  if (!domain) throw new Error(`${series.name} has no readings to chart`);
  const plotWidth = size.width -
    (axes ? AXIS_MARGIN.left + AXIS_MARGIN.right : PADDING * 2);
  const frame = axes ? chartAxes(series, plotWidth) : null;
  const flint = assembleChartjs(flintInput(series, size, curve)) as unknown as
    & FlintChartjs
    & Record<string, unknown>;
  const [line] = flint.data.datasets;
  const [bottom, top] = frame?.y.domain ?? domain.y;
  const [start, end] = domain.x.map(dateMs);
  const rows = chartRows(series);
  const colour = (flagged: boolean) =>
    flagged ? palette.critical : palette.series;
  const point = (r: (typeof rows)[number]): ChartjsPoint => ({
    x: r.date,
    y: r.value,
    tooltip: r.tooltip,
  });
  const filled = rows.filter((r) => !r.bound);
  const hollow = rows.filter((r) => r.bound);
  const markers = {
    showLine: false,
    pointRadius: MARKER_RADIUS,
    pointHoverRadius: MARKER_RADIUS,
    pointHitRadius: HOVER_RADIUS,
    pointBorderWidth: 2,
    pointHoverBorderWidth: 2,
  };
  const font = { family: palette.font, size: 11 };
  const xLabels = new Map(
    frame?.x.ticks.map((tick) => [tick.value, tick.lines]) ?? [],
  );

  const xScale = frame
    ? {
      display: true,
      grid: { display: false },
      border: { color: palette.axis },
      title: { display: false },
      // Ticks exactly at the readings, as every backend shows them.
      afterBuildTicks: (scale: Scale) => {
        scale.ticks = frame.x.ticks.map((tick) => ({ value: tick.value }));
      },
      afterFit: (scale: Scale) => {
        scale.height = AXIS_MARGIN.bottom;
      },
      ticks: {
        callback: (value: string | number) => xLabels.get(Number(value)) ?? "",
        color: palette.muted,
        font,
        autoSkip: false,
        maxRotation: 0,
        padding: 4,
      },
    }
    : { display: false };
  const yScale = frame
    ? {
      display: true,
      grid: { color: palette.grid },
      border: { display: false },
      title: { display: false },
      afterFit: (scale: Scale) => {
        scale.width = AXIS_MARGIN.left;
      },
      ticks: {
        stepSize: frame.y.step,
        callback: (value: string | number) => VALUE.format(Number(value)),
        color: palette.muted,
        font,
        padding: 8,
      },
    }
    : { display: false };

  // Flint's own bookkeeping (_width, _pivot, …) is left behind: only its
  // type, data and options go to Chart.js.
  return {
    type: "line",
    data: {
      datasets: [
        // Flint's line, keeping its curve, restyled to the theme. Higher
        // `order` draws underneath.
        {
          ...line,
          label: series.name,
          data: rows.map(point),
          borderColor: palette.series,
          borderWidth: 2,
          borderCapStyle: "round",
          borderJoinStyle: "round",
          backgroundColor: "transparent",
          // Flint's smoothing can bulge past a reading, and its step-after
          // steps come out as Chart.js's "after", which changes value straight
          // after the previous reading. Monotone smoothing and "before" steps
          // match the other libraries: each result holds until the next.
          ...(curve === "smooth" ? { cubicInterpolationMode: "monotone" } : {}),
          ...(curve === "steps" ? { stepped: "before" } : {}),
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointHitRadius: 0,
          order: 3,
        },
        {
          ...markers,
          label: "Readings",
          data: filled.map(point),
          pointBackgroundColor: filled.map((r) => colour(r.flagged)),
          pointBorderColor: palette.surface,
          pointHoverBackgroundColor: filled.map((r) => colour(r.flagged)),
          pointHoverBorderColor: palette.surface,
          order: 2,
        },
        // A bound ("< 5") is drawn hollow: the true value is somewhere past it.
        {
          ...markers,
          label: "Reported as a bound",
          data: hollow.map(point),
          pointBackgroundColor: palette.surface,
          pointBorderColor: hollow.map((r) => colour(r.flagged)),
          pointHoverBackgroundColor: palette.surface,
          pointHoverBorderColor: hollow.map((r) => colour(r.flagged)),
          order: 1,
        },
      ],
    },
    options: {
      ...flint.options,
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: frame
          ? {
            top: AXIS_MARGIN.top,
            right: AXIS_MARGIN.right,
            left: 0,
            bottom: 0,
          }
          : PADDING,
      },
      interaction: { mode: "nearest", intersect: true },
      scales: {
        x: {
          ...flint.options.scales.x,
          ...xScale,
          type: "linear",
          min: start,
          max: end,
        },
        y: {
          ...flint.options.scales.y,
          ...yScale,
          type: "linear",
          beginAtZero: false,
          min: bottom,
          max: top,
        },
      },
      plugins: {
        ...flint.options.plugins,
        legend: { display: false },
        // The page draws its own tooltip (see chartjs.ts).
        tooltip: { enabled: false },
      },
    },
    plugins: [
      referenceBands(series, palette, [bottom, top], frame?.rangeLabel ?? null),
    ],
  } as ChartConfiguration<"line", ChartjsPoint[]>;
}
