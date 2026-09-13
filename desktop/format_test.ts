import { assertEquals } from "@std/assert";
import {
  displayName,
  initials,
  monthSpan,
  monthYear,
  plural,
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
