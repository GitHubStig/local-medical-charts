/**
 * App settings: what they are, their defaults, and how values from the page
 * are checked. No runtime imports, so the Vue app can use it too.
 *
 * Settings live in SQLite rather than the webview's localStorage, because the
 * window's address gets a new port on every launch and localStorage is keyed by
 * address — saved values would disappear on the next start.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Chart libraries the dashboard can draw with, through Flint. */
export const CHART_LIBRARIES = [
  "vega-lite",
  "echarts",
  "chartjs",
  "plotly",
] as const;
export type ChartLibrary = (typeof CHART_LIBRARIES)[number];

/** How a chart's line joins the readings: straight, a smooth curve, or steps. */
export const CHART_CURVES = ["straight", "smooth", "steps"] as const;
export type ChartCurve = (typeof CHART_CURVES)[number];

/** The app's own chart look; any other chart theme is one of Flint's. */
export const APP_CHART_THEME = "app";

/** Checked for shape only: which themes exist depends on the installed Flint. */
const isChartTheme = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value);

export type Settings = {
  /** "system" follows the operating system's light or dark appearance. */
  theme: Theme;
  /** The patient the dashboard last showed; null before one is chosen. */
  selectedPatientId: number | null;
  chartLibrary: ChartLibrary;
  chartCurve: ChartCurve;
  /** "app" for the app's own look, or the id of one of Flint's themes. */
  chartTheme: string;
  /** Where Ollama listens, for reading PDFs and photos. */
  ollamaHost: string;
  /** The Ollama model that reads report pages; null until one is chosen. */
  ocrModel: string | null;
  /** Show a system notification when a reading finishes while the window isn't in front. */
  notifyWhenRead: boolean;
};

export const DEFAULT_OLLAMA_HOST = "http://localhost:11434";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  selectedPatientId: null,
  chartLibrary: "vega-lite",
  chartCurve: "smooth",
  chartTheme: APP_CHART_THEME,
  ollamaHost: DEFAULT_OLLAMA_HOST,
  ocrModel: null,
  notifyWhenRead: true,
};

export class SettingsError extends Error {
  override name = "SettingsError";
}

const isTheme = (value: unknown): value is Theme =>
  (THEMES as readonly unknown[]).includes(value);

const isChartLibrary = (value: unknown): value is ChartLibrary =>
  (CHART_LIBRARIES as readonly unknown[]).includes(value);

const isChartCurve = (value: unknown): value is ChartCurve =>
  (CHART_CURVES as readonly unknown[]).includes(value);

/** An http(s) address with nothing after the port, tidied to its origin; null if it isn't one. */
function ollamaOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    const bare = url.pathname === "/" && !url.search && !url.hash;
    return (url.protocol === "http:" || url.protocol === "https:") && bare
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const isModelName = (value: unknown): value is string | null =>
  value === null ||
  (typeof value === "string" && value.length > 0 && value.length <= 200 &&
    !/\s/.test(value));

const isPatientId = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" && Number.isSafeInteger(value) && value > 0);

/** Checks a partial update from the page. Unknown keys and invalid values are refused. */
export function parseSettingsPatch(value: unknown): Partial<Settings> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsError("settings must be an object");
  }
  const patch: Partial<Settings> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "theme") {
      if (!isTheme(entry)) {
        throw new SettingsError(`theme must be one of ${THEMES.join(", ")}`);
      }
      patch.theme = entry;
    } else if (key === "selectedPatientId") {
      if (!isPatientId(entry)) {
        throw new SettingsError(
          "selectedPatientId must be a positive integer or null",
        );
      }
      patch.selectedPatientId = entry;
    } else if (key === "chartLibrary") {
      if (!isChartLibrary(entry)) {
        throw new SettingsError(
          `chartLibrary must be one of ${CHART_LIBRARIES.join(", ")}`,
        );
      }
      patch.chartLibrary = entry;
    } else if (key === "chartCurve") {
      if (!isChartCurve(entry)) {
        throw new SettingsError(
          `chartCurve must be one of ${CHART_CURVES.join(", ")}`,
        );
      }
      patch.chartCurve = entry;
    } else if (key === "chartTheme") {
      if (!isChartTheme(entry)) {
        throw new SettingsError(
          "chartTheme must be app or a theme id such as economist",
        );
      }
      patch.chartTheme = entry;
    } else if (key === "ollamaHost") {
      const origin = ollamaOrigin(entry);
      if (!origin) {
        throw new SettingsError(
          "ollamaHost must be an http(s) address such as http://localhost:11434",
        );
      }
      patch.ollamaHost = origin;
    } else if (key === "ocrModel") {
      if (!isModelName(entry)) {
        throw new SettingsError("ocrModel must be a model name or null");
      }
      patch.ocrModel = entry;
    } else if (key === "notifyWhenRead") {
      if (typeof entry !== "boolean") {
        throw new SettingsError("notifyWhenRead must be true or false");
      }
      patch.notifyWhenRead = entry;
    } else {
      throw new SettingsError(`unknown setting "${key}"`);
    }
  }
  return patch;
}

/**
 * Stored values as Settings. Anything unknown or no longer valid falls back to
 * its default, so a removed or renamed option never breaks startup.
 */
export function normalizeSettings(stored: Record<string, unknown>): Settings {
  return {
    theme: isTheme(stored.theme) ? stored.theme : DEFAULT_SETTINGS.theme,
    selectedPatientId: isPatientId(stored.selectedPatientId)
      ? stored.selectedPatientId
      : DEFAULT_SETTINGS.selectedPatientId,
    chartLibrary: isChartLibrary(stored.chartLibrary)
      ? stored.chartLibrary
      : DEFAULT_SETTINGS.chartLibrary,
    chartCurve: isChartCurve(stored.chartCurve)
      ? stored.chartCurve
      : DEFAULT_SETTINGS.chartCurve,
    chartTheme: isChartTheme(stored.chartTheme)
      ? stored.chartTheme
      : DEFAULT_SETTINGS.chartTheme,
    ollamaHost: ollamaOrigin(stored.ollamaHost) ?? DEFAULT_SETTINGS.ollamaHost,
    ocrModel: isModelName(stored.ocrModel)
      ? stored.ocrModel
      : DEFAULT_SETTINGS.ocrModel,
    notifyWhenRead: typeof stored.notifyWhenRead === "boolean"
      ? stored.notifyWhenRead
      : DEFAULT_SETTINGS.notifyWhenRead,
  };
}
