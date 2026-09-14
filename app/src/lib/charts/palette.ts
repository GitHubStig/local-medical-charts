/** Colours resolved from the theme's CSS tokens: chart libraries can't read CSS variables. */
export type ChartPalette = {
  series: string;
  band: string;
  bandEdge: string;
  critical: string;
  surface: string;
  /** Axis label text. */
  muted: string;
  /** Value grid lines behind the plot. */
  grid: string;
  /** The date axis line and its ticks. */
  axis: string;
  /** The app's font stack, so chart labels match the page. */
  font: string;
};
