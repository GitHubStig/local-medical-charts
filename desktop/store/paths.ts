/**
 * Where the app keeps its database.
 *
 * Deno has no API for the platform's app-data folder, so it's worked out here
 * from the OS and environment. `MEDICAL_CHARTS_DATA_DIR` overrides it, which
 * keeps development runs and tests away from real data.
 */
import { join as posixJoin } from "@std/path/posix";
import { join as windowsJoin } from "@std/path/windows";

export const APP_NAME = "Medical Charts";
export const DATABASE_FILE = "medical-charts.db";

type Env = { get(key: string): string | undefined };

export function appDataDir(os: typeof Deno.build.os, env: Env): string {
  const override = env.get("MEDICAL_CHARTS_DATA_DIR");
  if (override) return override;

  if (os === "windows") {
    const appData = env.get("APPDATA");
    if (!appData) throw new Error("APPDATA is not set");
    return windowsJoin(appData, APP_NAME);
  }

  const home = env.get("HOME");
  if (!home) throw new Error("HOME is not set");
  if (os === "darwin") {
    return posixJoin(home, "Library", "Application Support", APP_NAME);
  }
  // Linux and other Unix-likes follow the XDG base directory convention.
  return posixJoin(
    env.get("XDG_DATA_HOME") || posixJoin(home, ".local", "share"),
    "medical-charts",
  );
}

export function databasePath(os: typeof Deno.build.os, env: Env): string {
  const dir = appDataDir(os, env);
  return os === "windows"
    ? windowsJoin(dir, DATABASE_FILE)
    : posixJoin(dir, DATABASE_FILE);
}
