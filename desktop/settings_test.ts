import { assertEquals, assertThrows } from "@std/assert";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsPatch,
  SettingsError,
} from "./settings.ts";

Deno.test("a valid settings patch is accepted", () => {
  assertEquals(parseSettingsPatch({ theme: "dark" }), { theme: "dark" });
  assertEquals(parseSettingsPatch({ selectedPatientId: 3 }), {
    selectedPatientId: 3,
  });
  assertEquals(parseSettingsPatch({ selectedPatientId: null }), {
    selectedPatientId: null,
  });
  assertEquals(parseSettingsPatch({ chartLibrary: "echarts" }), {
    chartLibrary: "echarts",
  });
  assertEquals(parseSettingsPatch({}), {});
});

Deno.test("invalid settings from the page are refused", () => {
  assertThrows(
    () => parseSettingsPatch({ theme: "blue" }),
    SettingsError,
    "theme must be one of",
  );
  assertThrows(
    () => parseSettingsPatch({ selectedPatientId: 0 }),
    SettingsError,
    "positive integer or null",
  );
  assertThrows(
    () => parseSettingsPatch({ selectedPatientId: "3" }),
    SettingsError,
    "positive integer or null",
  );
  assertThrows(
    () => parseSettingsPatch({ chartLibrary: "d3" }),
    SettingsError,
    "chartLibrary must be one of",
  );
  assertThrows(
    () => parseSettingsPatch({ fontSize: 14 }),
    SettingsError,
    "unknown setting",
  );
  assertThrows(
    () => parseSettingsPatch(null),
    SettingsError,
    "must be an object",
  );
  assertThrows(
    () => parseSettingsPatch(["dark"]),
    SettingsError,
    "must be an object",
  );
});

Deno.test("stored settings fall back to defaults for anything unknown or invalid", () => {
  assertEquals(normalizeSettings({}), DEFAULT_SETTINGS);
  assertEquals(
    normalizeSettings({
      theme: "light",
      selectedPatientId: 2,
      chartLibrary: "echarts",
      retired: true,
    }),
    { theme: "light", selectedPatientId: 2, chartLibrary: "echarts" },
  );
  assertEquals(
    // A library that's been removed falls back too.
    normalizeSettings({ theme: 42, selectedPatientId: -1, chartLibrary: "d3" }),
    DEFAULT_SETTINGS,
  );
});
