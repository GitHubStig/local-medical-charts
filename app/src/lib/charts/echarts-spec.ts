/**
 * The ECharts chart for a Series: Flint assembles the line chart, then an
 * overlay adds the lab's reference bands (markArea, with markLine edges), the
 * reading markers, and axes on the large chart. Only the ECharts parts used
 * here are bundled. No DOM types, so Deno tests can build and render it.
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
import type { ChartCurve } from "../../../../desktop/settings.ts";
import { dateMs, type Series } from "../series.ts";
import { AXIS_MARGIN, chartAxes } from "./axes.ts";
import { bandEdges, chartBands, chartRows, flintInput } from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

use([
  LineChart,
  ScatterChart,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  SVGRenderer,
]);

/** Room around a bare chart so markers at the edges aren't clipped. */
const PADDING = 6;
/** Diameter: a 4px-radius dot plus its 2px ring, as in the Vega-Lite charts. */
const MARKER_SIZE = 10;
/** The series whose invisible, larger markers answer hovers. */
export const HOVER_TARGETS = "hover-targets";

const VALUE = new Intl.NumberFormat("en", { maximumFractionDigits: 6 });

/** Flint's own bookkeeping (pivots, sizes) isn't part of an ECharts option. */
function withoutFlintKeys(option: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(option).filter(([key]) => !key.startsWith("_")),
  );
}

/** `size` is the whole chart; with `axes`, the labels take their room from it. */
export function echartsOption(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
  axes = false,
  curve: ChartCurve = "straight",
): EChartsCoreOption {
  const domain = series.domain;
  if (!domain) throw new Error(`${series.name} has no readings to chart`);
  const margin = axes ? AXIS_MARGIN : {
    top: PADDING,
    right: PADDING,
    bottom: PADDING,
    left: PADDING,
  };
  const plot = {
    width: size.width - margin.left - margin.right,
    height: size.height - margin.top - margin.bottom,
  };
  const frame = axes ? chartAxes(series, plot.width) : null;
  const flint = withoutFlintKeys(
    assembleECharts(flintInput(series, plot, curve)) as Record<string, unknown>,
  );
  const [line] = flint.series as Record<string, unknown>[];
  const [bottom, top] = frame?.y.domain ?? domain.y;
  const [start, end] = domain.x.map(dateMs);
  const rows = chartRows(series);
  const colour = (flagged: boolean) =>
    flagged ? palette.critical : palette.series;
  const text = { color: palette.muted, fontFamily: palette.font, fontSize: 11 };

  const bandList = chartBands(series, [bottom, top]);
  const bands = bandList.map((band, i) => [
    {
      xAxis: band.start,
      yAxis: band.low,
      // The latest lab range, written just past the right edge of its band.
      ...(frame?.rangeLabel && i === bandList.length - 1
        ? {
          label: {
            show: true,
            position: "right",
            distance: 8,
            formatter: frame.rangeLabel.text,
            ...text,
          },
        }
        : {}),
    },
    { xAxis: band.end, yAxis: band.high },
  ]);
  const edges = bandEdges(series).map((edge) => [
    { coord: [edge.start, edge.value] },
    { coord: [edge.end, edge.value] },
  ]);

  // Ticks exactly at the readings, labelled with date and lab on two lines.
  const xTicks = frame?.x.ticks.map((tick) => tick.value) ?? [];
  const xLabels = new Map(
    frame?.x.ticks.map((tick) => [tick.value, tick.lines.join("\n")]) ?? [],
  );

  return {
    animation: false,
    backgroundColor: "transparent",
    // No tooltip component: the page draws its own from the hover targets.
    color: [palette.series],
    grid: { ...margin },
    xAxis: {
      ...(flint.xAxis as object),
      type: "time",
      name: "",
      min: start,
      max: end,
      ...(frame
        ? {
          show: true,
          splitLine: { show: false },
          axisLine: { show: true, lineStyle: { color: palette.axis } },
          axisTick: {
            show: true,
            customValues: xTicks,
            lineStyle: { color: palette.axis },
          },
          axisLabel: {
            ...text,
            customValues: xTicks,
            formatter: (value: number) => xLabels.get(value) ?? "",
            lineHeight: 15,
            margin: 8,
            rotate: 0,
            hideOverlap: false,
          },
        }
        : { show: false }),
    },
    yAxis: {
      ...(flint.yAxis as object),
      type: "value",
      name: "",
      scale: true,
      min: bottom,
      max: top,
      ...(frame
        ? {
          show: true,
          interval: frame.y.step,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: true, lineStyle: { color: palette.grid } },
          axisLabel: {
            ...text,
            formatter: (value: number) => VALUE.format(value),
            margin: 8,
            rotate: 0,
          },
        }
        : { show: false }),
    },
    series: [
      // Flint's line, keeping its curve, restyled to the theme, carrying the
      // bands behind it.
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
  axes = false,
): string {
  const chart = echartsInstance(size);
  try {
    chart.setOption(echartsOption(series, palette, size, axes));
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}
