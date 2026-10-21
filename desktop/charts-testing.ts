/**
 * What the chart tests share: one palette, the dashboard's chart sizes, and
 * Alex Tan's series from the fictional sample reports.
 */
import type { Series } from "../app/src/lib/series.ts";
import { sampleSeries } from "./samples-testing.ts";

export const PALETTE = {
  series: "#2a78d6",
  band: "#eceae4",
  bandEdge: "#d3cfc6",
  critical: "#d03b3b",
  surface: "#ffffff",
  muted: "#77706b",
  grid: "#eeece7",
  axis: "#d6d2ca",
  font: "IBM Plex Sans, sans-serif",
};

/** The zoomed view's chart, with axes. */
export const LARGE = { width: 1088, height: 320 };
/** A card's chart. */
export const SIZE = { width: 294, height: 64 };

/** One of Alex Tan's series, by its card key. */
export function alexSeries(key: string): Promise<Series> {
  return sampleSeries("ALEX TAN", key);
}
