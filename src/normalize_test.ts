import { assert, assertEquals } from "@std/assert";
import { indexCatalog } from "./catalog.ts";
import {
  buildReport,
  deriveFlag,
  parseDate,
  parseRange,
  parseResult,
} from "./normalize.ts";
import type { PageExtraction, Report } from "./schema.ts";
import { normalizeUnit } from "./units.ts";

// All fixtures below are synthetic.

Deno.test("parseResult reads numbers, comparators and words", () => {
  assertEquals(parseResult("5.0"), { kind: "numeric", value: 5 });
  assertEquals(parseResult("(2.61)"), { kind: "numeric", value: 2.61 });
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
  assertEquals(parseResult("Negative"), { kind: "text", text: "Negative" });
});

Deno.test("parseResult drops a unit repeated after the value", () => {
  assertEquals(parseResult("6.1 %", "%"), { kind: "numeric", value: 6.1 });
  assertEquals(parseResult("0 x 10^6/L", "x10^6/L"), {
    kind: "numeric",
    value: 0,
  });
});

Deno.test("parseRange reads plain and bracketed min-max", () => {
  assertEquals(parseRange("4.0 - 11.0"), { kind: "between", min: 4, max: 11 });
  assertEquals(parseRange("(120-150)"), {
    kind: "between",
    min: 120,
    max: 150,
  });
  assertEquals(parseRange("(3.9 - 6.0)"), {
    kind: "between",
    min: 3.9,
    max: 6,
  });
});

Deno.test("parseRange reads one-sided bounds in any wrapping", () => {
  assertEquals(parseRange("(< 5.2)"), {
    kind: "below",
    limit: 5.2,
    inclusive: false,
  });
  assertEquals(parseRange("(> 1.20)"), {
    kind: "above",
    limit: 1.2,
    inclusive: false,
  });
  assertEquals(parseRange("(Ref.Range:>= 60)"), {
    kind: "above",
    limit: 60,
    inclusive: true,
  });
  assertEquals(parseRange("(<10 x 10^6/L)", "x 10^6/L"), {
    kind: "below",
    limit: 10,
    inclusive: false,
  });
});

Deno.test("parseRange keeps qualitative and banded ranges apart", () => {
  assertEquals(parseRange("(Negative)"), {
    kind: "qualitative",
    expected: "Negative",
  });
  const banded = "Normal <5.7%; Prediabetes 5.7-6.2%; Diabetes >=6.3%";
  assertEquals(parseRange(banded, "%"), { kind: "text", text: banded });
  assertEquals(parseRange(null), null);
  assertEquals(parseRange(" ( ) "), null);
});

Deno.test("parseDate reads day-first dates with 2- or 4-digit years", () => {
  const today = new Date("2026-06-01");
  assertEquals(parseDate("15-08-1990", today), "1990-08-15");
  assertEquals(parseDate("15/08/90", today), "1990-08-15");
  assertEquals(parseDate("14/01/2025 08:30:00", today), "2025-01-14T08:30:00");
  assertEquals(parseDate("14/01/25 08:30", today), "2025-01-14T08:30:00");
  assertEquals(parseDate("31/13/2020", today), null);
  assertEquals(parseDate("Last Page", today), null);
  assertEquals(parseDate(null, today), null);
});

Deno.test("normalizeUnit unifies spellings without converting", () => {
  assertEquals(normalizeUnit("x 10^9/L"), "x10^9/L");
  assertEquals(normalizeUnit("x 10⁹/L"), "x10^9/L");
  assertEquals(normalizeUnit("fl"), "fL");
  assertEquals(normalizeUnit("IU/L"), "U/L");
  assertEquals(normalizeUnit("ml/min/1.73m^2"), normalizeUnit("mL/min/1.73m²"));
  assertEquals(normalizeUnit("Ratio"), null);
  assertEquals(normalizeUnit("cells/uL"), "cells/uL");
});

Deno.test("deriveFlag trusts a printed H or L", () => {
  const range = parseRange("55 - 62");
  assertEquals(deriveFlag("L", parseResult("52"), range).flag, "L");
  assertEquals(deriveFlag("H", parseResult("58"), range).source, "printed");
});

Deno.test("deriveFlag gives a * marker its direction from the range", () => {
  const below = deriveFlag("*", parseResult("110"), parseRange("(120-150)"));
  assertEquals([below.flag, below.source], ["L", "derived"]);

  const inside = deriveFlag("*", parseResult("130"), parseRange("(120-150)"));
  assertEquals([inside.flag, inside.source], ["A", "printed"]);
  assert(inside.warning?.includes("within its reference range"));
});

Deno.test("deriveFlag flags unmarked out-of-range and qualitative results", () => {
  assertEquals(
    deriveFlag(null, parseResult("5.4"), parseRange("(3.5-5.1)")).flag,
    "H",
  );
  assertEquals(
    deriveFlag(null, parseResult("4.0"), parseRange("(3.5-5.1)")).flag,
    null,
  );
  assertEquals(
    deriveFlag(null, parseResult("Positive"), parseRange("(Negative)")).flag,
    "A",
  );
  assertEquals(
    deriveFlag(null, parseResult("Negative"), parseRange("(Negative)")).flag,
    null,
  );
});

Deno.test("deriveFlag only classifies comparators when the bound settles it", () => {
  assertEquals(
    deriveFlag(null, parseResult("< 3"), parseRange("(< 51)")).flag,
    null,
  );
  assertEquals(
    deriveFlag(null, parseResult(">=90"), parseRange(">= 60")).flag,
    null,
  );
  assertEquals(
    deriveFlag(null, parseResult("< 10"), parseRange("39.0 - 189.0")).flag,
    "L",
  );
});

const miniCatalog = indexCatalog({
  analytes: [
    {
      id: "haemoglobin",
      name: "Haemoglobin",
      specimen: "blood",
      unit: "g/dL",
      aliases: ["Haemoglobin"],
      units: { "g/dL": 1, "g/L": 0.1 },
    },
    {
      id: "glucose",
      name: "Glucose",
      specimen: "blood",
      unit: "mmol/L",
      aliases: ["Glucose"],
      units: { "mmol/L": 1 },
    },
    {
      id: "urine_glucose",
      name: "Urine glucose",
      specimen: "urine",
      unit: "",
      aliases: ["Glucose"],
      units: { "": 1 },
    },
  ],
});

function page(
  partial: Partial<PageExtraction> & { page: number },
): PageExtraction {
  return {
    pageCount: 2,
    provider: {
      name: "Example Lab",
      address: null,
      phone: null,
      website: null,
    },
    patient: {
      name: "TEST PATIENT",
      idNumber: "X0000000",
      dateOfBirth: "15/08/90",
      sex: "Female",
      age: "35",
    },
    doctor: { name: "DR EXAMPLE", clinic: null },
    dates: {
      collected: "14/01/25 08:30",
      received: null,
      requested: null,
      reported: null,
    },
    headerFields: [{ label: "Lab No.", value: "00-0000000" }],
    tests: [],
    continuationText: null,
    interpretation: [],
    specimenNotes: ["Comment: Fasting"],
    warnings: [],
    ...partial,
  };
}

const source: Report["source"] = {
  report: "example",
  images: [],
  pages: 2,
  model: "test",
  promptHash: "test",
  catalogHash: "test",
  extractedAt: "",
  mergedAt: "",
};

function mergeExample(): Report {
  return buildReport(
    [
      page({
        page: 1,
        tests: [
          {
            headings: ["HAEMATOLOGY"],
            specimen: "blood",
            name: "Haemoglobin",
            nameZh: null,
            measurements: [
              {
                value: "118",
                unit: "g/L",
                referenceText: "(120-150)",
                marker: "*",
              },
            ],
            notes: [],
          },
          {
            headings: ["URINE FEME", "CHEMISTRY"],
            specimen: "urine",
            name: "Glucose",
            nameZh: null,
            measurements: [
              {
                value: "Normal",
                unit: null,
                referenceText: "(Normal)",
                marker: null,
              },
            ],
            notes: [],
          },
          {
            headings: [],
            specimen: "blood",
            name: "Hormone X",
            nameZh: null,
            measurements: [
              {
                value: "20",
                unit: "pg/mL",
                referenceText: "Phase A 1 - 2",
                marker: null,
              },
            ],
            notes: [],
          },
        ],
      }),
      page({
        page: 2,
        continuationText: "Phase B 3 - 4",
        tests: [
          {
            headings: ["SERUM/PLASMA GLUCOSE"],
            specimen: null,
            name: "Glucose",
            nameZh: null,
            measurements: [
              {
                value: "5.1",
                unit: "mmol/L",
                referenceText: "(3.9 - 6.0)",
                marker: null,
              },
            ],
            notes: [],
          },
        ],
      }),
    ],
    source,
    miniCatalog,
  );
}

Deno.test("buildReport converts to the catalog unit and derives the flag", () => {
  const hb = mergeExample().tests.find((t) => t.name === "Haemoglobin")!;
  assertEquals(hb.analyte, "haemoglobin");
  assertEquals(hb.standard, { op: null, value: 11.8, unit: "g/dL" });
  assertEquals([hb.flag, hb.flagSource], ["L", "derived"]);
});

Deno.test("buildReport keeps same-named blood and urine tests apart", () => {
  const glucose = mergeExample().tests.filter((t) => t.name === "Glucose");
  assertEquals(glucose.map((t) => t.analyte).sort(), [
    "glucose",
    "urine_glucose",
  ]);
  assertEquals(
    glucose.find((t) => t.analyte === "urine_glucose")!.standard,
    null,
  );
});

Deno.test("buildReport attaches carried-over ranges to the previous page's result", () => {
  const report = mergeExample();
  const hormone = report.tests.find((t) => t.name === "Hormone X")!;
  assertEquals(hormone.printed.referenceText, "Phase A 1 - 2; Phase B 3 - 4");
  assertEquals(hormone.analyte, null);
  assertEquals(report.unmapped.map((u) => u.name), ["Hormone X"]);
});

Deno.test("buildReport reconciles repeated header content", () => {
  const report = mergeExample();
  assertEquals(report.collectedAt, "2025-01-14T08:30:00");
  assertEquals(report.collectedAtSource, "collected");
  assertEquals(report.patient.dateOfBirthIso, "1990-08-15");
  assertEquals(report.specimenNotes, ["Comment: Fasting"]);
  assertEquals(report.headerFields, [{
    label: "Lab No.",
    value: "00-0000000",
  }]);
});

Deno.test("buildReport never puts personal values in warnings", () => {
  const report = buildReport(
    [
      page({ page: 1 }),
      page({
        page: 2,
        patient: { ...page({ page: 2 }).patient, name: "OTHER READING" },
      }),
    ],
    source,
    miniCatalog,
  );
  const warning = report.warnings.find((w) => w.startsWith("patient.name"));
  assert(warning, "expected a disagreement warning");
  assert(
    !warning.includes("TEST PATIENT") && !warning.includes("OTHER READING"),
  );
});
