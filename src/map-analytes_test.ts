import { assert, assertEquals } from "@std/assert";
import { loadCatalog } from "./catalog.ts";
import { type Item, toSuggestion } from "./map-analytes.ts";

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
