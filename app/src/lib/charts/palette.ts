/** Colours resolved from the theme's CSS tokens: chart libraries can't read CSS variables. */
export type ChartPalette = {
  series: string;
  band: string;
  bandEdge: string;
  critical: string;
  surface: string;
};
