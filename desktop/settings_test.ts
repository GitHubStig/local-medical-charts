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
    {
      ...DEFAULT_SETTINGS,
      theme: "light",
      selectedPatientId: 2,
      chartLibrary: "echarts",
    },
  );
  assertEquals(
    // A library that's been removed falls back too.
    normalizeSettings({ theme: 42, selectedPatientId: -1, chartLibrary: "d3" }),
    DEFAULT_SETTINGS,
  );
});

Deno.test("the Ollama address is tidied to its origin and model names are checked", () => {
  assertEquals(parseSettingsPatch({ ollamaHost: "http://localhost:11434/" }), {
    ollamaHost: "http://localhost:11434",
  });
  assertEquals(
    parseSettingsPatch({ ollamaHost: " http://192.168.1.20:11434 " }),
    { ollamaHost: "http://192.168.1.20:11434" },
  );
  assertEquals(parseSettingsPatch({ ocrModel: "qwen3.8:27b-mlx" }), {
    ocrModel: "qwen3.8:27b-mlx",
  });
  assertEquals(parseSettingsPatch({ ocrModel: null }), { ocrModel: null });

  for (
    const ollamaHost of [
      "localhost:11434",
      "ftp://localhost",
      "http://localhost:11434/api",
      11434,
    ]
  ) {
    assertThrows(
      () => parseSettingsPatch({ ollamaHost }),
      SettingsError,
      "ollamaHost must be",
    );
  }
  for (const ocrModel of ["", "two words", 7]) {
    assertThrows(
      () => parseSettingsPatch({ ocrModel }),
      SettingsError,
      "ocrModel must be",
    );
  }
  assertEquals(
    normalizeSettings({ ollamaHost: "nonsense", ocrModel: 42 }),
    DEFAULT_SETTINGS,
  );
});

Deno.test("notifications when a reading finishes are on by default and take true or false", () => {
  assertEquals(DEFAULT_SETTINGS.notifyWhenRead, true);
  assertEquals(parseSettingsPatch({ notifyWhenRead: false }), {
    notifyWhenRead: false,
  });
  assertThrows(
    () => parseSettingsPatch({ notifyWhenRead: "no" }),
    SettingsError,
    "true or false",
  );
  assertEquals(
    normalizeSettings({ notifyWhenRead: false }).notifyWhenRead,
    false,
  );
  assertEquals(
    normalizeSettings({ notifyWhenRead: "yes" }).notifyWhenRead,
    true,
  );
});
