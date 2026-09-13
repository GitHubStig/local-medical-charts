/**
 * The Vega-Lite chart for a Series: Flint assembles the line chart, then an
 * overlay layers the lab's reference bands and the reading markers around it.
 * No DOM here, so Deno tests can build and render it.
 */
import { assembleVegaLite } from "flint-chart/vegalite";
import { parse, View } from "vega";
import { compile, type TopLevelSpec } from "vega-lite";
import { dateMs, type Series } from "../series.ts";
import { chartRows, flintInput } from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

/** Room around the plot so markers at the edges aren't clipped. */
export const PADDING = 6;
const MARKER_SIZE = 64;

/** Flint's own bookkeeping (editor options, pivots) isn't part of Vega-Lite. */
function withoutFlintKeys(spec: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(spec).filter(([key]) => !key.startsWith("_")),
  );
}

export function vegaLiteSpec(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
): TopLevelSpec {
  const domain = series.domain;
  if (!domain) throw new Error(`${series.name} has no readings to chart`);
  const flint = withoutFlintKeys(
    assembleVegaLite(flintInput(series, size)) as Record<string, unknown>,
  );
  const [bottom, top] = domain.y;

  // Every layer shares one pair of hidden axes. The window is set once, on the
  // line: Vega-Lite warns when layers restate the same domain.
  const x = { field: "date", type: "temporal" as const, axis: null };
  const y = {
    field: "value",
    type: "quantitative" as const,
    axis: null,
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

  const bands = series.bands.map((band) => ({
    start: dateMs(band.start),
    end: dateMs(band.end),
    low: band.min ?? bottom,
    high: band.max ?? top,
  }));
  const edges = series.bands.flatMap((band) =>
    [band.min, band.max].flatMap((value) =>
      value === null
        ? []
        : [{ start: dateMs(band.start), end: dateMs(band.end), value }]
    )
  );
  const colour = {
    condition: { test: "datum.flagged", value: palette.critical },
    value: palette.series,
  };

  return {
    width: size.width,
    height: size.height,
    padding: PADDING,
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
      // Flint's line, restyled to the theme.
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
    ],
  };
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
