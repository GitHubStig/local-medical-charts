import { assertEquals } from "@std/assert";
import {
  ageOn,
  dateAndTime,
  dayMonthYear,
  displayName,
  displaySex,
  formatDuration,
  formatMeasurement,
  initials,
  maskId,
  monthSpan,
  monthYear,
  plural,
  timestamp,
} from "../app/src/lib/format.ts";

// Synthetic names only.

Deno.test("month and year come straight from the ISO text", () => {
  assertEquals(monthYear("2026-03-18T08:40:00"), "Mar 2026");
  assertEquals(monthYear("2024-11-01"), "Nov 2024");
  assertEquals(monthYear("2024-13-01"), null);
  assertEquals(monthYear(null), null);
});

Deno.test("month spans collapse when both ends match", () => {
  assertEquals(monthSpan("2024-11-12", "2026-03-18"), "Nov 2024 – Mar 2026");
  assertEquals(monthSpan("2026-03-01", "2026-03-18"), "Mar 2026");
  assertEquals(monthSpan(null, "2026-03-18"), "Mar 2026");
  assertEquals(monthSpan(null, null), null);
});

Deno.test("capitalised names are shown in title case", () => {
  assertEquals(displayName("ALEX TAN"), "Alex Tan");
  assertEquals(displayName("JORDAN O'NEIL-SMITH"), "Jordan O'Neil-Smith");
  assertEquals(displayName("  "), "Unnamed patient");
  assertEquals(displayName(null), "Unnamed patient");
});

Deno.test("initials take the first and last words", () => {
  assertEquals(initials("Alex Tan"), "AT");
  assertEquals(initials("alex jordan tan"), "AT");
  assertEquals(initials("Madonna"), "MA");
  assertEquals(initials(null), "?");
});

Deno.test("plural picks the right word", () => {
  assertEquals(plural(1, "report"), "1 report");
  assertEquals(plural(4, "report"), "4 reports");
});

Deno.test("dates and times read straight from the printed text", () => {
  assertEquals(dayMonthYear("2026-03-08T08:40:00"), "8 Mar 2026");
  assertEquals(dateAndTime("2026-03-18T08:40:00"), "18 Mar 2026, 08:40");
  assertEquals(dateAndTime("1990-08-15"), "15 Aug 1990");
  assertEquals(dateAndTime(null), null);
});

// Exact wording comes from the engine's Intl; these expectations match Deno (V8).
Deno.test("timestamps are shown in the given time zone", () => {
  assertEquals(
    timestamp("2026-03-19T13:14:00.000Z", "UTC"),
    "19 Mar 2026, 13:14",
  );
  assertEquals(
    timestamp("2026-03-19T13:14:00.000Z", "Asia/Singapore"),
    "19 Mar 2026, 21:14",
  );
  assertEquals(timestamp("nonsense"), null);
});

Deno.test("age counts whole years, turning over on the birthday", () => {
  const onBirthday = new Date(2026, 7, 15);
  assertEquals(ageOn("1990-08-15", onBirthday), 36);
  assertEquals(ageOn("1990-08-16", onBirthday), 35);
  assertEquals(ageOn(null, onBirthday), null);
});

Deno.test("sex and ID numbers are shown tidily", () => {
  assertEquals(displaySex("FEMALE"), "Female");
  assertEquals(displaySex("m"), "Male");
  assertEquals(displaySex(null), null);
  assertEquals(maskId("X1234567"), "•••• 4567");
  assertEquals(maskId("AB12"), "AB12");
  assertEquals(maskId(null), null);
});

Deno.test("measurements show their comparator and unit", () => {
  assertEquals(formatMeasurement(47, null, "U/L"), "47 U/L");
  assertEquals(formatMeasurement(5, "<", "U/L"), "< 5 U/L");
  assertEquals(
    formatMeasurement(90, ">=", "mL/min/1.73m²"),
    "≥ 90 mL/min/1.73m²",
  );
  assertEquals(formatMeasurement(1.23456, null, null), "1.23");
});

Deno.test("durations are whole seconds, worded by Intl", () => {
  assertEquals(formatDuration(124_400), "2 min, 4 sec");
  assertEquals(formatDuration(9_000), "9 sec");
  assertEquals(formatDuration(3_723_000), "1 hr, 2 min, 3 sec");
  assertEquals(formatDuration(200), "0 sec");
});
