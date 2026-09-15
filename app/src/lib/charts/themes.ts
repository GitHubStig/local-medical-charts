/**
 * Flint's visual themes for the charts. "app" is the app's own look; any other
 * id is a theme Flint ships, passed to Flint as `theme_spec`.
 *
 * A chart library shows a theme only where Flint actually styles that
 * library's output for it, so support follows Flint and the chart libraries as
 * they're updated; elsewhere the chart keeps the app's look. Whatever the
 * theme, flagged results, hollow markers for bounds, the lab's reference bands
 * and the dates and labs on the axis stay the app's.
 */
import {
  type ChartAssemblyInput,
  listThemePresets,
  resolveThemeSpec,
} from "flint-chart/core";
import { APP_CHART_THEME as APP_THEME } from "../../../../desktop/settings.ts";
import type { ChartPalette } from "./palette.ts";

export { APP_THEME };

export type ChartTheme = { id: string; label: string };

/** The app's own look first, then every theme this version of Flint ships. */
export function chartThemes(): ChartTheme[] {
  return [
    { id: APP_THEME, label: "App" },
    ...listThemePresets().map(({ id, label }) => ({ id, label })),
  ];
}

/** Flint input with the theme, or unchanged for the app's own look. */
export function withTheme(
  input: ChartAssemblyInput,
  theme: string,
): ChartAssemblyInput {
  return theme === APP_THEME ? input : { ...input, theme_spec: theme };
}

/** A small fixed line chart for checking what a theme changes; no real data. */
const PROBE: ChartAssemblyInput = {
  data: {
    values: [
      { date: Date.UTC(2025, 0, 1), value: 4 },
      { date: Date.UTC(2025, 5, 1), value: 6 },
      { date: Date.UTC(2026, 0, 1), value: 5 },
    ],
  },
  semantic_types: { date: "DateTime", value: "Quantity" },
  chart_spec: {
    chartType: "Line Chart",
    encodings: {
      x: { field: "date", type: "temporal" },
      y: { field: "value", type: "quantitative" },
    },
    canvasSize: { width: 300, height: 120 },
  },
};

/** Flint's own bookkeeping keys start with "_" and aren't part of the output. */
const fingerprint = (value: unknown) =>
  JSON.stringify(
    value,
    (key, entry) => key.startsWith("_") ? undefined : entry,
  );

const support = new Map<string, boolean>();

/**
 * Whether Flint styles a library's output for a theme: the probe chart
 * assembled with and without the theme differs. Worked out once per library
 * and theme; a theme this Flint doesn't know counts as unsupported.
 */
export function themeApplies(
  library: string,
  theme: string,
  assemble: (input: ChartAssemblyInput) => unknown,
): boolean {
  if (theme === APP_THEME) return false;
  const key = `${library}\n${theme}`;
  let applies = support.get(key);
  if (applies === undefined) {
    try {
      applies = fingerprint(assemble(PROBE)) !==
        fingerprint(assemble(withTheme(PROBE, theme)));
    } catch {
      applies = false;
    }
    support.set(key, applies);
  }
  return applies;
}

/** A hex colour ("#rgb", "#rrggbb", with or without alpha) as red, green, blue. */
function channels(colour: string): number[] | null {
  const hex = colour.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(hex) || ![3, 4, 6, 8].includes(hex.length)) {
    return null;
  }
  const full = hex.length <= 4
    ? [...hex.slice(0, 3)].map((digit) => digit + digit).join("")
    : hex.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** `from` moved `amount` (0 to 1) of the way to `to`, as "#rrggbb"; null unless both are hex. */
export function mixColour(
  from: string,
  to: string,
  amount: number,
): string | null {
  const a = channels(from), b = channels(to);
  if (!a || !b) return null;
  return "#" +
    a.map((value, i) =>
      Math.round(value + (b[i] - value) * amount).toString(16).padStart(2, "0")
    ).join("");
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/**
 * The overlay's colours for a themed chart: the surface, font and line colour
 * Flint gave the chart, the theme's text, grid and axis ink, and reference
 * bands mixed from its surface and text. Flags keep the app's colour.
 */
export function themePalette(
  theme: string,
  app: ChartPalette,
  flint: { surface?: unknown; font?: unknown; series?: unknown },
): ChartPalette {
  const ink = resolveThemeSpec(theme)?.ink;
  const surface = text(flint.surface) ?? text(ink?.surface?.plot) ?? "#ffffff";
  const primary = text(ink?.text?.primary) ?? app.muted;
  return {
    series: text(flint.series) ?? text(ink?.series?.single) ?? app.series,
    band: mixColour(surface, primary, 0.08) ?? app.band,
    bandEdge: mixColour(surface, primary, 0.22) ?? app.bandEdge,
    critical: app.critical,
    surface,
    muted: text(ink?.text?.secondary) ?? primary,
    grid: text(ink?.structure?.grid) ?? app.grid,
    axis: text(ink?.structure?.axis) ?? app.axis,
    font: text(flint.font) ?? app.font,
  };
}
