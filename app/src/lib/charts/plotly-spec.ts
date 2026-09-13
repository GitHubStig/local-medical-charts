/**
 * The Plotly chart for a Series: Flint assembles the line trace, then an
 * overlay adds the lab's reference bands as layout shapes and the reading
 * markers as their own traces. Plotly itself isn't imported here, so Deno
 * tests can build the figure.
 */
import { assemblePlotly } from "flint-chart/plotly";
import { dateMs, type Series } from "../series.ts";
import { bandEdges, chartBands, chartRows, flintInput } from "./flint-input.ts";
import type { ChartPalette } from "./palette.ts";

/** Room around the plot so markers at the edges aren't clipped. */
const PADDING = 6;
/** Marker diameter; with its 2px ring it matches the other backends. */
const MARKER_SIZE = 8;
/** How close the pointer must be to a marker to show its hover text. */
const HOVER_DISTANCE = 12;
const TRANSPARENT = "rgba(0, 0, 0, 0)";

export type PlotlyFigure = {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
};

type FlintPlotly = {
  data: Record<string, unknown>[];
  // deno-lint-ignore no-explicit-any
  layout: { xaxis: object; yaxis: object } & Record<string, any>;
};

export function plotlyFigure(
  series: Series,
  palette: ChartPalette,
  size: { width: number; height: number },
): PlotlyFigure {
  const domain = series.domain;
  if (!domain) throw new Error(`${series.name} has no readings to chart`);
  const flint = assemblePlotly(
    flintInput(series, size),
  ) as unknown as FlintPlotly;
  const [line] = flint.data;
  const [bottom, top] = domain.y;
  const [start, end] = domain.x.map(dateMs);
  const rows = chartRows(series);
  const colour = (flagged: boolean) =>
    flagged ? palette.critical : palette.series;
  const filled = rows.filter((r) => !r.bound);
  const hollow = rows.filter((r) => r.bound);

  // Milliseconds on a linear axis: Plotly's date axes don't reliably keep the
  // time zone of date strings, and these axes are hidden anyway.
  const axis = {
    visible: false,
    fixedrange: true,
    automargin: false,
    type: "linear",
  };
  const markers = (points: typeof rows) => ({
    type: "scatter",
    mode: "markers",
    x: points.map((r) => r.date),
    y: points.map((r) => r.value),
    customdata: points.map((r) => r.tooltip),
    hoverinfo: "none",
  });

  // Flint's bookkeeping (_width, _pivot, …) is left behind: only its data and
  // layout go to Plotly.
  return {
    data: [
      // Flint's line, restyled to the theme; it never answers hovers itself.
      {
        ...line,
        type: "scatter",
        mode: "lines",
        x: rows.map((r) => r.date),
        y: rows.map((r) => r.value),
        line: {
          ...(line.line as object),
          color: palette.series,
          width: 2,
          shape: "linear",
        },
        hoverinfo: "skip",
      },
      {
        ...markers(filled),
        name: "Readings",
        marker: {
          size: MARKER_SIZE,
          color: filled.map((r) => colour(r.flagged)),
          line: { color: palette.surface, width: 2 },
        },
      },
      // A bound ("< 5") is drawn hollow: the true value is somewhere past it.
      {
        ...markers(hollow),
        name: "Reported as a bound",
        marker: {
          size: MARKER_SIZE,
          color: palette.surface,
          line: { color: hollow.map((r) => colour(r.flagged)), width: 2 },
        },
      },
    ],
    layout: {
      ...flint.layout,
      width: size.width,
      height: size.height,
      margin: { t: PADDING, r: PADDING, b: PADDING, l: PADDING, pad: 0 },
      xaxis: { ...flint.layout.xaxis, ...axis, range: [start, end] },
      yaxis: {
        ...flint.layout.yaxis,
        ...axis,
        rangemode: "normal",
        range: [bottom, top],
      },
      showlegend: false,
      paper_bgcolor: TRANSPARENT,
      plot_bgcolor: TRANSPARENT,
      hovermode: "closest",
      hoverdistance: HOVER_DISTANCE,
      dragmode: false,
      shapes: [
        ...chartBands(series).map((band) => ({
          type: "rect",
          xref: "x",
          yref: "y",
          x0: band.start,
          x1: band.end,
          y0: band.low,
          y1: band.high,
          fillcolor: palette.band,
          line: { width: 0 },
          layer: "below",
        })),
        ...bandEdges(series).map((edge) => ({
          type: "line",
          xref: "x",
          yref: "y",
          x0: edge.start,
          x1: edge.end,
          y0: edge.value,
          y1: edge.value,
          line: { color: palette.bandEdge, width: 1 },
          layer: "below",
        })),
      ],
    },
    config: {
      displayModeBar: false,
      responsive: false,
      scrollZoom: false,
      doubleClick: false,
      showTips: false,
    },
  };
}
