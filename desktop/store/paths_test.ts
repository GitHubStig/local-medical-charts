import { assertEquals, assertThrows } from "@std/assert";
import { appDataDir, databasePath } from "./paths.ts";

const env = (vars: Record<string, string>) => ({ get: (k: string) => vars[k] });

Deno.test("app data follows each platform's convention", () => {
  assertEquals(
    appDataDir("darwin", env({ HOME: "/Users/example" })),
    "/Users/example/Library/Application Support/Medical Charts",
  );
  assertEquals(
    appDataDir(
      "windows",
      env({ APPDATA: "C:\\Users\\example\\AppData\\Roaming" }),
    ),
    "C:\\Users\\example\\AppData\\Roaming\\Medical Charts",
  );
  assertEquals(
    appDataDir("linux", env({ HOME: "/home/example" })),
    "/home/example/.local/share/medical-charts",
  );
  assertEquals(
    appDataDir("linux", env({ HOME: "/home/example", XDG_DATA_HOME: "/data" })),
    "/data/medical-charts",
  );
});

Deno.test("MEDICAL_CHARTS_DATA_DIR overrides the platform folder", () => {
  assertEquals(
    databasePath(
      "darwin",
      env({ HOME: "/Users/example", MEDICAL_CHARTS_DATA_DIR: "/tmp/dev" }),
    ),
    "/tmp/dev/medical-charts.db",
  );
});

Deno.test("a missing home folder is an error, not a guess", () => {
  assertThrows(() => appDataDir("darwin", env({})), Error, "HOME is not set");
  assertThrows(
    () => appDataDir("windows", env({})),
    Error,
    "APPDATA is not set",
  );
});
