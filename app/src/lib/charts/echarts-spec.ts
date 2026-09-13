/**
 * The ECharts chart for a Series: Flint assembles the line chart, then an
 * overlay adds the lab's reference bands (markArea, with markLine edges) and
 * the reading markers. Only the ECharts parts used here are bundled. No DOM
 * types, so Deno tests can build and render it.
 */
import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from "echarts/components";
import { type EChartsCoreOption, init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { assembleECharts } from "flint-chart/echarts";
import { dateMs, type Series } from "../series.ts";
import { chartRows, flintInput } from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

use([
  LineChart,
  ScatterChart,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  SVGRenderer,
]);

/** Room around the plot so markers at the edges aren't clipped. */
const PADDING = 6;
/** Diameter: a 4px-radius dot plus its 2px ring, as in the Vega-Lite charts. */
const MARKER_SIZE = 10;
/** The series whose invisible, larger markers answer hovers. */
export const HOVER_TARGETS = "hover-targets";

/** Flint's own bookkeeping (pivots, sizes) isn't part of an ECharts option. */
function withoutFlintKeys(option: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(option).filter(([key]) => !key.startsWith("_")),
  );
}

export function echartsOption(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
): EChartsCoreOption {
  const domain = series.domain;
  if (!domain) throw new Error(`${series.name} has no readings to chart`);
  const flint = withoutFlintKeys(
    assembleECharts(flintInput(series, size)) as Record<string, unknown>,
  );
  const [line] = flint.series as Record<string, unknown>[];
  const [bottom, top] = domain.y;
  const [start, end] = domain.x.map(dateMs);
  const rows = chartRows(series);
  const colour = (flagged: boolean) =>
    flagged ? palette.critical : palette.series;

  const bands = series.bands.map((band) => [
    { xAxis: dateMs(band.start), yAxis: band.min ?? bottom },
    { xAxis: dateMs(band.end), yAxis: band.max ?? top },
  ]);
  const edges = series.bands.flatMap((band) =>
    [band.min, band.max].flatMap((value) =>
      value === null ? [] : [[
        { coord: [dateMs(band.start), value] },
        { coord: [dateMs(band.end), value] },
      ]]
    )
  );

  return {
    animation: false,
    backgroundColor: "transparent",
    // No tooltip component: the page draws its own from the hover targets.
    color: [palette.series],
    grid: { left: PADDING, right: PADDING, top: PADDING, bottom: PADDING },
    xAxis: {
      ...(flint.xAxis as object),
      type: "time",
      show: false,
      min: start,
      max: end,
    },
    yAxis: {
      ...(flint.yAxis as object),
      type: "value",
      show: false,
      scale: true,
      min: bottom,
      max: top,
    },
    series: [
      // Flint's line, restyled to the theme, carrying the bands behind it.
      {
        ...line,
        type: "line",
        symbol: "none",
        showSymbol: false,
        silent: true,
        z: 2,
        lineStyle: {
          color: palette.series,
          width: 2,
          cap: "round",
          join: "round",
        },
        itemStyle: { color: palette.series },
        markArea: {
          silent: true,
          itemStyle: { color: palette.band },
          data: bands,
        },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          lineStyle: { color: palette.bandEdge, width: 1, type: "solid" },
          data: edges,
        },
      },
      {
        type: "scatter",
        silent: true,
        z: 3,
        symbol: "circle",
        symbolSize: MARKER_SIZE,
        data: rows.filter((r) => !r.bound).map((r) => ({
          value: [r.date, r.value],
          itemStyle: {
            color: colour(r.flagged),
            borderColor: palette.surface,
            borderWidth: 2,
            opacity: 1, // scatter markers default to 0.8
          },
        })),
      },
      // A bound ("< 5") is drawn hollow: the true value is somewhere past it.
      {
        type: "scatter",
        silent: true,
        z: 3,
        symbol: "circle",
        symbolSize: MARKER_SIZE,
        data: rows.filter((r) => r.bound).map((r) => ({
          value: [r.date, r.value],
          itemStyle: {
            color: palette.surface,
            borderColor: colour(r.flagged),
            borderWidth: 2,
            opacity: 1,
          },
        })),
      },
      // Invisible, larger targets, so hovering doesn't need pixel precision.
      {
        id: HOVER_TARGETS,
        type: "scatter",
        z: 4,
        symbol: "circle",
        symbolSize: 24,
        itemStyle: { color: "transparent", opacity: 0 },
        emphasis: { disabled: true },
        data: rows.map((r) => ({
          value: [r.date, r.value],
          tooltip: r.tooltip,
        })),
      },
    ],
  };
}

/** An ECharts instance: drawn into `container`, or server-side (for SVG strings) without one. */
export function echartsInstance(
  size: { width: number; height: number },
  container?: object,
) {
  return init(container as never ?? null, null, {
    renderer: "svg",
    ssr: !container,
    width: size.width,
    height: size.height,
  });
}

/** The chart as an SVG string, without a browser. */
export function echartsSvg(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
): string {
  const chart = echartsInstance(size);
  try {
    chart.setOption(echartsOption(series, palette, size));
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}
