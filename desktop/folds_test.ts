import { assertEquals } from "@std/assert";
import {
  isFoldOpen,
  rememberFold,
  reportRegion,
} from "../app/src/lib/folds.ts";

Deno.test("a region keeps its default until it's folded or opened", () => {
  const memory = new Map<string, boolean>();
  assertEquals(isFoldOpen(memory, 1, "tests", true), true);
  assertEquals(isFoldOpen(memory, 1, reportRegion(7), false), false);

  rememberFold(memory, 1, "tests", false);
  rememberFold(memory, 1, reportRegion(7), true);
  assertEquals(isFoldOpen(memory, 1, "tests", true), false);
  assertEquals(isFoldOpen(memory, 1, reportRegion(7), false), true);
});

Deno.test("each patient's regions are remembered apart", () => {
  const memory = new Map<string, boolean>();
  rememberFold(memory, 1, "reports", false);
  assertEquals(isFoldOpen(memory, 1, "reports", true), false);
  assertEquals(isFoldOpen(memory, 2, "reports", true), true);
});

Deno.test("a report's interpretation and notes fold apart from the report", () => {
  const memory = new Map<string, boolean>();
  rememberFold(memory, 1, reportRegion(7, "interpretation"), true);
  assertEquals(isFoldOpen(memory, 1, reportRegion(7), false), false);
  assertEquals(
    isFoldOpen(memory, 1, reportRegion(7, "interpretation"), false),
    true,
  );
  assertEquals(isFoldOpen(memory, 1, reportRegion(7, "notes"), false), false);
});
