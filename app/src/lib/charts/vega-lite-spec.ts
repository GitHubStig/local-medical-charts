/**
 * The Vega-Lite chart for a Series: Flint assembles the line chart, then an
 * overlay layers the lab's reference bands and the reading markers around it,
 * with axes on the large chart. No DOM here, so Deno tests can build and
 * render it.
 */
import { assembleVegaLite } from "flint-chart/vegalite";
import { parse, View } from "vega";
import { compile, type TopLevelSpec } from "vega-lite";
import type { ChartCurve } from "../../../../desktop/settings.ts";
import { dateMs, type Series } from "../series.ts";
import { AXIS_MARGIN, chartAxes } from "./axes.ts";
import { bandEdges, chartBands, chartRows, flintInput } from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

/** Room around a bare chart so markers at the edges aren't clipped. */
const PADDING = 6;
const MARKER_SIZE = 64;

/** Flint's own bookkeeping (editor options, pivots) isn't part of Vega-Lite. */
function withoutFlintKeys(spec: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(spec).filter(([key]) => !key.startsWith("_")),
  );
}

/** `size` is the whole chart; with `axes`, the labels take their room from it. */
export function vegaLiteSpec(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
  axes = false,
  curve: ChartCurve = "straight",
): TopLevelSpec {
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
    assembleVegaLite(flintInput(series, plot, curve)) as Record<
      string,
      unknown
    >,
  );
  const [bottom, top] = frame?.y.domain ?? domain.y;

  const label = {
    labelColor: palette.muted,
    labelFont: palette.font,
    labelFontSize: 11,
  };
  // Tick values are milliseconds; each label is looked up from the shared axes,
  // as two lines (date, then lab).
  const xLabels = Object.fromEntries(
    frame?.x.ticks.map((tick) => [tick.value, tick.lines]) ?? [],
  );
  const xAxis = frame
    ? {
      ...label,
      values: frame.x.ticks.map((tick) => tick.value),
      labelExpr: `${JSON.stringify(xLabels)}[toString(+datum.value)]`,
      labelLineHeight: 15,
      labelPadding: 6,
      // The shared axes already thin labels to fit; Vega's default limit
      // would cut lab names short ("Northside …").
      labelLimit: 0,
      labelOverlap: false,
      grid: false,
      domainColor: palette.axis,
      tickColor: palette.axis,
      title: null,
    }
    : null;
  const yAxis = frame
    ? {
      ...label,
      values: frame.y.ticks,
      // Plain numbers ("20", "1,000"): "~g" alone writes 20 as "2e+1".
      format: ",.12~g",
      labelPadding: 8,
      grid: true,
      gridColor: palette.grid,
      domain: false,
      ticks: false,
      title: null,
    }
    : null;

  // Every layer shares one pair of axes. The window is set once, on the line:
  // Vega-Lite warns when layers restate the same domain.
  const x = {
    field: "date",
    type: "temporal" as const,
    axis: xAxis,
    title: null,
  };
  const y = {
    field: "value",
    type: "quantitative" as const,
    axis: yAxis,
    title: null,
  };
  const window = {
    x: {
      ...x,
      scale: { type: "utc" as const, domain: domain.x.map(dateMs) },
    },
    y: {
      ...y,
      scale: { domain: [bottom, top], zero: false, nice: false },
    },
  };

  const bands = chartBands(series, [bottom, top]);
  const edges = bandEdges(series);
  const colour = {
    condition: { test: "datum.flagged", value: palette.critical },
    value: palette.series,
  };

  return {
    width: plot.width,
    height: plot.height,
    padding: margin,
    autosize: { type: "none" },
    background: "transparent",
    config: {
      ...(flint.config as object),
      view: { stroke: null },
      aria: false,
    },
    data: { values: chartRows(series) },
    layer: [
      {
        data: { values: bands },
        mark: { type: "rect", color: palette.band },
        encoding: {
          x: { ...x, field: "start" },
          x2: { field: "end" },
          y: { ...y, field: "low" },
          y2: { field: "high" },
        },
      },
      {
        data: { values: edges },
        mark: { type: "rule", color: palette.bandEdge, strokeWidth: 1 },
        encoding: {
          x: { ...x, field: "start" },
          x2: { field: "end" },
          y: { ...y, field: "value" },
        },
      },
      // Flint's line, keeping its curve, restyled to the theme.
      {
        mark: {
          ...(flint.mark as object),
          type: "line",
          point: false,
          color: palette.series,
          strokeWidth: 2,
          strokeCap: "round",
          strokeJoin: "round",
        },
        encoding: { ...(flint.encoding as object), ...window },
      },
      {
        transform: [{ filter: "!datum.bound" }],
        mark: {
          type: "point",
          shape: "circle",
          filled: true,
          size: MARKER_SIZE,
          opacity: 1,
          stroke: palette.surface,
          strokeWidth: 2,
        },
        encoding: { x, y, fill: colour },
      },
      // A bound ("< 5") is drawn hollow: the true value is somewhere past it.
      {
        transform: [{ filter: "datum.bound" }],
        mark: {
          type: "point",
          shape: "circle",
          filled: false,
          size: MARKER_SIZE,
          opacity: 1,
          fill: palette.surface,
          strokeWidth: 2,
        },
        encoding: { x, y, stroke: colour },
      },
      // Invisible, larger targets, so hovering doesn't need pixel precision.
      {
        mark: {
          type: "point",
          shape: "circle",
          size: 500,
          opacity: 0,
          fill: "transparent",
          stroke: "transparent",
        },
        encoding: { x, y, tooltip: { field: "tooltip" } },
      },
      // The latest lab range, written just past the right edge of its band.
      ...(frame?.rangeLabel
        ? [{
          data: { values: [frame.rangeLabel] },
          mark: {
            type: "text" as const,
            align: "left" as const,
            baseline: "middle" as const,
            dx: 8,
            color: palette.muted,
            font: palette.font,
            fontSize: 11,
          },
          encoding: {
            x: { value: plot.width },
            y: { ...y, field: "y" },
            text: { field: "text" },
          },
        }]
        : []),
    ],
  } as TopLevelSpec;
}

/** Compiles to Vega, collecting Vega-Lite's warnings instead of logging them. */
export function compileVegaLite(spec: TopLevelSpec) {
  const warnings: string[] = [];
  const logger = {
    level: () => logger,
    warn: (...args: unknown[]) => (warnings.push(args.join(" ")), logger),
    info: () => logger,
    debug: () => logger,
    error: (...args: unknown[]) => {
      throw new Error(args.join(" "));
    },
  };
  return {
    vega: compile(spec, { logger: logger as never }).spec,
    warnings,
  };
}

/** A Vega view for the spec: rendered into `container`, or headless without one. */
export function vegaView(spec: TopLevelSpec, container?: HTMLElementLike) {
  const { vega, warnings } = compileVegaLite(spec);
  for (const warning of warnings) console.warn(`Vega-Lite: ${warning}`);
  return new View(parse(vega), {
    renderer: container ? "svg" : "none",
    container: container as never,
    hover: !!container,
  });
}

/** The chart as an SVG string, without a browser. */
export async function vegaLiteSvg(spec: TopLevelSpec): Promise<string> {
  const view = vegaView(spec);
  try {
    return await view.toSVG();
  } finally {
    view.finalize();
  }
}

/** Stands in for HTMLElement, which Deno's type check doesn't have. */
type HTMLElementLike = object;
