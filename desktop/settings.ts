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

export type Settings = {
  /** "system" follows the operating system's light or dark appearance. */
  theme: Theme;
  /** The patient the dashboard last showed; null before one is chosen. */
  selectedPatientId: number | null;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  selectedPatientId: null,
};

export class SettingsError extends Error {
  override name = "SettingsError";
}

const isTheme = (value: unknown): value is Theme =>
  (THEMES as readonly unknown[]).includes(value);

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
  };
}
