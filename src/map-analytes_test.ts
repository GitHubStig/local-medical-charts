import { assert, assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  type Catalog,
  type CatalogIndex,
  indexCatalog,
  loadCatalog,
} from "./catalog.ts";
import {
  applySuggestions,
  collectUnmatched,
  type Item,
  type Suggestion,
  toSuggestion,
} from "./map-analytes.ts";
import { buildReport } from "./normalize.ts";
import type { PageExtraction } from "./schema.ts";

// Synthetic items only.

const catalog = await loadCatalog();

function item(partial: Partial<Item>): Item {
  return {
    name: "Test",
    nameZh: null,
    specimen: "blood",
    unit: null,
    headings: [],
    referenceText: null,
    reason: "not in the catalog",
    reports: ["synthetic"],
    ...partial,
  };
}

Deno.test("a new analyte that changes the printed specimen needs a check", () => {
  const s = toSuggestion(
    item({ name: "Haemoglobin", unit: "mmol/L", specimen: "blood" }),
    {
      item: 1,
      action: "new",
      analyteId: "haemoglobin_urine",
      name: "Urine haemoglobin",
      specimen: "urine",
      reason: "",
    },
    catalog,
  );
  assertEquals(s.accept, false);
  assert(s.check?.includes("changed the specimen"), s.check ?? "no check");
});

Deno.test("an alias needing a new unit leaves the factor for a person", () => {
  const s = toSuggestion(
    item({ name: "Haemoglobin", unit: "mmol/L" }),
    {
      item: 1,
      action: "alias",
      analyteId: "haemoglobin",
      name: null,
      specimen: "blood",
      reason: "",
    },
    catalog,
  );
  assertEquals(s.factor, null);
  assert(s.check?.includes("set factor"), s.check ?? "no check");
});

Deno.test("an alias with a known unit takes the factor from the catalog", () => {
  const s = toSuggestion(
    item({ name: "Alk Phosphatase", unit: "U/L" }),
    {
      item: 1,
      action: "alias",
      analyteId: "alp",
      name: null,
      specimen: "blood",
      reason: "",
    },
    catalog,
  );
  assertEquals([s.factor, s.check], [1, null]);
});

Deno.test("an alias to an analyte that does not exist is flagged", () => {
  const s = toSuggestion(
    item({ name: "Something" }),
    {
      item: 1,
      action: "alias",
      analyteId: "no_such_analyte",
      name: null,
      specimen: "blood",
      reason: "",
    },
    catalog,
  );
  assert(s.check?.includes("not in the catalog"), s.check ?? "no check");
});

// ---- Applying accepted suggestions, against a small made-up catalog rather than
// src/analytes.json, so these only change when the rules do.

const smallCatalog: Catalog = {
  analytes: [
    {
      id: "haemoglobin",
      name: "Haemoglobin",
      specimen: "blood",
      group: "Other",
      unit: "g/dL",
      aliases: ["Haemoglobin"],
      units: { "g/dL": 1 },
    },
    {
      id: "glucose",
      name: "Glucose",
      specimen: "blood",
      group: "Other",
      unit: "mmol/L",
      aliases: ["Glucose"],
      units: { "mmol/L": 1 },
    },
  ],
};
const small = indexCatalog(smallCatalog, "small");

function suggestion(partial: Partial<Suggestion>): Suggestion {
  return {
    accept: true,
    action: "alias",
    analyteId: "haemoglobin",
    name: null,
    specimen: "blood",
    printedName: "HGB",
    nameZh: null,
    unit: "g/dL",
    factor: null,
    group: null,
    headings: [],
    reports: ["synthetic"],
    reason: "made up",
    check: null,
    ...partial,
  };
}

const analyte = (catalog: Catalog, id: string) =>
  catalog.analytes.find((a) => a.id === id);

Deno.test("an accepted alias adds the printed name, leaving the catalog it was given alone", () => {
  const result = applySuggestions([suggestion({ printedName: "HGB" })], small);
  assertEquals(analyte(result.catalog, "haemoglobin")?.aliases, [
    "Haemoglobin",
    "HGB",
  ]);
  assertEquals(result.applied.length, 1);
  assertEquals(result.pending, []);
  assertEquals(analyte(small.catalog, "haemoglobin")?.aliases, ["Haemoglobin"]);
});

Deno.test("an alias in a unit the analyte doesn't know needs a factor first", () => {
  assertThrows(
    () =>
      applySuggestions(
        [suggestion({ printedName: "Hb", unit: "g/L" })],
        small,
      ),
    Error,
    "factor",
  );
  const result = applySuggestions(
    [suggestion({ printedName: "Hb", unit: "g/L", factor: 0.1 })],
    small,
  );
  assertEquals(analyte(result.catalog, "haemoglobin")?.units, {
    "g/dL": 1,
    "g/L": 0.1,
  });
});

Deno.test("an accepted new analyte gets the printed name, its own unit at factor 1, and a group", () => {
  const result = applySuggestions([
    suggestion({
      action: "new",
      analyteId: "ferritin",
      name: "Ferritin",
      printedName: "Serum Ferritin",
      unit: "ng/mL",
    }),
  ], small);
  assertEquals(analyte(result.catalog, "ferritin"), {
    id: "ferritin",
    name: "Ferritin",
    specimen: "blood",
    group: "Other",
    unit: "ng/mL",
    aliases: ["Serum Ferritin"],
    units: { "ng/mL": 1 },
  });
});

Deno.test("nothing is applied while any accepted suggestion is invalid", () => {
  const err = assertThrows(
    () =>
      applySuggestions([
        suggestion({ printedName: "HGB" }),
        suggestion({ printedName: "Mystery", analyteId: "mystery" }),
        suggestion({
          action: "new",
          analyteId: "Ferritin!",
          name: "Ferritin",
          printedName: "Ferritin",
        }),
        suggestion({
          action: "new",
          analyteId: "glucose",
          name: "Glucose",
          printedName: "GLU",
        }),
        suggestion({
          action: "new",
          analyteId: "urea",
          name: null,
          printedName: "Urea",
          unit: "mmol/L",
        }),
      ], small),
    Error,
    "nothing applied",
  );
  for (
    const phrase of [
      "not in the catalog",
      "snake_case",
      "already exists",
      "needs a name and specimen",
    ]
  ) {
    assert(err.message.includes(phrase), phrase);
  }
});

Deno.test("a suggestion that would let one printed name match two analytes is refused", () => {
  assertThrows(
    () =>
      applySuggestions([
        suggestion({
          action: "new",
          analyteId: "fasting_glucose",
          name: "Fasting glucose",
          printedName: "Glucose",
          unit: "mmol/L",
        }),
      ], small),
    Error,
    "ambiguous",
  );
});

Deno.test("suggestions not yet accepted stay pending; accepted skips change nothing", () => {
  const waiting = suggestion({ accept: false, printedName: "HGB" });
  const result = applySuggestions([
    waiting,
    suggestion({ action: "skip", printedName: "Comment" }),
  ], small);
  assertEquals(result.applied, []);
  assertEquals(result.pending, [waiting]);
  assertEquals(result.catalog, small.catalog);
});

// ---- Gathering unmatched names from merged reports: made-up reports in a temporary folder.

function extraction(tests: [name: string, unit: string][]): PageExtraction {
  return {
    page: 1,
    pageCount: 1,
    provider: {
      name: "Example Lab",
      address: null,
      phone: null,
      website: null,
    },
    patient: {
      name: "ALEX EXAMPLE",
      idNumber: "X1234567",
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
    headerFields: [],
    tests: tests.map(([name, unit]) => ({
      headings: [],
      specimen: "blood",
      name,
      nameZh: null,
      measurements: [{ value: "1.0", unit, referenceText: null, marker: null }],
      notes: [],
    })),
    continuationText: null,
    interpretation: [],
    specimenNotes: [],
    warnings: [],
  };
}

function mergedReport(
  label: string,
  tests: [name: string, unit: string][],
  catalog: CatalogIndex,
): string {
  return JSON.stringify(buildReport(
    [{
      image: `${label}-1.jpg`,
      model: "test-model",
      promptHash: "test-prompt",
      extractedAt: "2025-01-15T10:00:00.000Z",
      extraction: extraction(tests),
    }],
    {
      report: label,
      catalogHash: catalog.hash,
      mergedAt: "2025-01-15T11:00:00.000Z",
    },
    catalog,
  ));
}

async function inFolder(
  files: Record<string, string>,
  fn: (dir: string) => Promise<void>,
) {
  const dir = await Deno.makeTempDir();
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const [name, text] of Object.entries(files)) {
      await Deno.writeTextFile(join(dir, name), text);
    }
    await fn(dir);
  } finally {
    console.warn = warn;
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("unmatched names are gathered across reports, once each, with the reports they came from", async () => {
  await inFolder({
    "jan.json": mergedReport("jan", [
      ["Haemoglobin", "g/dL"],
      ["Serum Ferritin", "ng/mL"],
    ], small),
    "mar.json": mergedReport("mar", [
      ["Serum Ferritin", "ng/mL"],
      ["Vitamin D", "nmol/L"],
    ], small),
    // Not merged reports, so not read.
    "jan-1.page.json": "{}",
    "analyte-suggestions.json": "{}",
    "notes.json": '{"hello": 1}',
  }, async (dir) => {
    const items = await collectUnmatched(dir, small);
    assertEquals(
      items.map((i) => [i.name, i.unit, i.specimen, [...i.reports].sort()]),
      [
        ["Serum Ferritin", "ng/mL", "blood", ["jan", "mar"]],
        ["Vitamin D", "nmol/L", "blood", ["mar"]],
      ],
    );
  });
});

Deno.test("names the catalog has learned since the reports were merged are left out", async () => {
  const learned = indexCatalog({
    analytes: [...smallCatalog.analytes, {
      id: "ferritin",
      name: "Ferritin",
      specimen: "blood",
      group: "Other",
      unit: "ng/mL",
      aliases: ["Serum Ferritin"],
      units: { "ng/mL": 1 },
    }],
  }, "learned");
  await inFolder({
    "jan.json": mergedReport("jan", [["Serum Ferritin", "ng/mL"]], small),
  }, async (dir) => {
    assertEquals(await collectUnmatched(dir, learned), []);
  });
});
