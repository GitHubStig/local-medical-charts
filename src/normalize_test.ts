import { assertEquals } from "@std/assert";
import { parseDate, parseRange, parseResult, testKey } from "./normalize.ts";
import type { RawTest } from "./schema.ts";

Deno.test("parseResult reads plain numbers", () => {
  assertEquals(parseResult("5.0"), { kind: "numeric", value: 5 });
  assertEquals(parseResult(" 263 "), { kind: "numeric", value: 263 });
});

Deno.test("parseResult keeps comparators", () => {
  assertEquals(parseResult("< 15.00"), {
    kind: "comparator",
    op: "<",
    value: 15,
  });
  assertEquals(parseResult(">=60"), {
    kind: "comparator",
    op: ">=",
    value: 60,
  });
});

Deno.test("parseResult falls back to text", () => {
  assertEquals(parseResult("Not Detected"), {
    kind: "text",
    text: "Not Detected",
  });
});

Deno.test("parseRange reads min-max", () => {
  assertEquals(parseRange("4.0 - 11.0"), {
    kind: "between",
    min: 4,
    max: 11,
  });
  assertEquals(parseRange("2.20 - 6.82"), {
    kind: "between",
    min: 2.2,
    max: 6.82,
  });
});

Deno.test("parseRange reads one-sided bounds", () => {
  assertEquals(parseRange("< 1.0"), {
    kind: "below",
    limit: 1,
    inclusive: false,
  });
  assertEquals(parseRange(">= 60"), {
    kind: "above",
    limit: 60,
    inclusive: true,
  });
});

Deno.test("parseRange keeps banded ranges as text", () => {
  const banded = "Normal <5.7%; Prediabetes 5.7-6.2%; Diabetes >=6.3%";
  assertEquals(parseRange(banded), { kind: "text", text: banded });
  assertEquals(parseRange(null), null);
  assertEquals(parseRange("  "), null);
});

Deno.test("parseDate reads the printed D/M/Y forms", () => {
  assertEquals(parseDate("15-08-1990"), "1990-08-15");
  assertEquals(parseDate("02/03/2026 09:04:00"), "2026-03-02T09:04:00");
  assertEquals(parseDate("02/03/2026 10:19"), "2026-03-02T10:19:00");
  assertEquals(parseDate("Last Page"), null);
  assertEquals(parseDate(null), null);
});

function raw(partial: Partial<RawTest>): RawTest {
  return {
    panel: null,
    name: "Test",
    nameZh: null,
    component: null,
    flag: null,
    value: "1",
    unit: null,
    referenceText: null,
    notes: [],
    ...partial,
  };
}

Deno.test("testKey separates the two halves of a differential", () => {
  const taken = new Set<string>();
  assertEquals(
    testKey(raw({ name: "Neutrophils", component: "percent" }), taken),
    "neutrophils_pct",
  );
  assertEquals(
    testKey(raw({ name: "Neutrophils", component: "absolute" }), taken),
    "neutrophils_abs",
  );
});

Deno.test("testKey slugifies punctuation", () => {
  const taken = new Set<string>();
  assertEquals(testKey(raw({ name: "NRBC / WBC %" }), taken), "nrbc_wbc");
  assertEquals(testKey(raw({ name: "ALT (SGPT)" }), taken), "alt_sgpt");
  assertEquals(
    testKey(raw({ name: "25-Hydroxy Vitamin D" }), taken),
    "25_hydroxy_vitamin_d",
  );
});

Deno.test("testKey disambiguates repeats by unit, then by count", () => {
  const taken = new Set<string>();
  assertEquals(
    testKey(raw({ name: "Calcium", unit: "mmol/L" }), taken),
    "calcium",
  );
  assertEquals(
    testKey(raw({ name: "Calcium", unit: "mg/dL" }), taken),
    "calcium_mg_dl",
  );
  assertEquals(
    testKey(raw({ name: "Calcium", unit: "mg/dL" }), taken),
    "calcium_mg_dl_2",
  );
});
