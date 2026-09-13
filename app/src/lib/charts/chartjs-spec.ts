/**
 * The Chart.js chart for a Series: Flint assembles the line chart, then an
 * overlay adds the reading markers and a small plugin that paints the lab's
 * reference bands behind them. Only Chart.js types are imported, so Deno tests
 * can build the config without a canvas.
 */
import type { ChartConfiguration, Plugin } from "chart.js";
import { assembleChartjs } from "flint-chart/chartjs";
import { dateMs, type Series } from "../series.ts";
import {
  type BandEdge,
  bandEdges,
  type ChartBand,
  chartBands,
  chartRows,
  flintInput,
} from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

/** Room around the plot so markers at the edges aren't clipped. */
const PADDING = 6;
const MARKER_RADIUS = 4;
/** How close the pointer must be to a marker to show its hover text. */
const HOVER_RADIUS = 12;

/** A plotted reading, carrying its hover text. */
export type ChartjsPoint = { x: number; y: number; tooltip: string };

type Scale = { getPixelForValue(value: number): number };
type Area = { left: number; right: number; top: number; bottom: number };

/** Where the bands and their edge lines go, in canvas pixels, kept inside the plot area. */
export function bandGeometry(
  bands: readonly ChartBand[],
  edges: readonly BandEdge[],
  x: Scale,
  y: Scale,
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

/** Paints the reference bands under the datasets; Chart.js has no band of its own. */
function referenceBands(series: Series, palette: ChartPalette): Plugin<"line"> {
  const bands = chartBands(series);
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
  };
}

type FlintChartjs = {
  data: { datasets: Record<string, unknown>[] };
  // deno-lint-ignore no-explicit-any
  options: { scales: { x: object; y: object }; plugins?: any };
};

export function chartjsConfig(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
): ChartConfiguration<"line", ChartjsPoint[]> {
  const domain = series.domain;
  if (!domain) throw new Error(`${series.name} has no readings to chart`);
  const flint = assembleChartjs(flintInput(series, size)) as unknown as
    & FlintChartjs
    & Record<string, unknown>;
  const [line] = flint.data.datasets;
  const [bottom, top] = domain.y;
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

  // Flint's own bookkeeping (_width, _pivot, …) is left behind: only its
  // type, data and options go to Chart.js.
  return {
    type: "line",
    data: {
      datasets: [
        // Flint's line, restyled to the theme. Higher `order` draws underneath.
        {
          ...line,
          label: series.name,
          data: rows.map(point),
          borderColor: palette.series,
          borderWidth: 2,
          borderCapStyle: "round",
          borderJoinStyle: "round",
          backgroundColor: "transparent",
          tension: 0,
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
      layout: { padding: PADDING },
      interaction: { mode: "nearest", intersect: true },
      scales: {
        x: {
          ...flint.options.scales.x,
          type: "linear",
          display: false,
          min: start,
          max: end,
        },
        y: {
          ...flint.options.scales.y,
          type: "linear",
          display: false,
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
    plugins: [referenceBands(series, palette)],
  } as ChartConfiguration<"line", ChartjsPoint[]>;
}
