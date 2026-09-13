import { assertEquals, assertThrows } from "@std/assert";
import {
  type Catalog,
  catalogFromJson,
  DEFAULT_CATALOG,
  formatCatalog,
  indexCatalog,
  loadCatalog,
  lookup,
} from "./catalog.ts";
import type { Specimen } from "./schema.ts";
import { normalizeUnit } from "./units.ts";

const index = await loadCatalog();

function find(
  name: string,
  unit: string | null,
  specimen: Specimen | null = null,
) {
  return lookup(index, { name, specimen, unit: normalizeUnit(unit) });
}

function analyteOf(
  name: string,
  unit: string | null,
  specimen: Specimen | null = null,
) {
  const match = find(name, unit, specimen);
  return match.kind === "mapped"
    ? match.analyte.id
    : `unmapped: ${match.reason}`;
}

/**
 * Test names and units as printed by two laboratories with different layouts.
 * Names only — no results.
 */
const PRINTED: [string, string | null, Specimen | null, string][] = [
  ["Total WBC", "x10^9/L", "blood", "wbc"],
  ["White Cell Count", "x 10^9/L", "blood", "wbc"],
  ["Neutrophils", "%", "blood", "neutrophils_pct"],
  ["Neutrophils", "x10^9/L", "blood", "neutrophils_abs"],
  ["Neutrophils", "x 10^9/L", "blood", "neutrophils_abs"],
  ["IG", "%", "blood", "ig_pct"],
  ["Haemoglobin", "g/dL", "blood", "haemoglobin"],
  ["Haemoglobin", "g/L", "blood", "haemoglobin"],
  ["PCV", "%", "blood", "haematocrit"],
  ["PCV", "L/L", "blood", "haematocrit"],
  ["Total RBC", "x10^12/L", "blood", "rbc"],
  ["RBC", "x 10^12/L", "blood", "rbc"],
  ["NRBC / WBC %", "%", "blood", "nrbc_pct"],
  ["Platelet Count", "x10^9/L", "blood", "platelets"],
  ["Platelets", "x 10^9/L", "blood", "platelets"],
  ["MPV", "fl", "blood", "mpv"],
  ["N:L Ratio", null, "blood", "nl_ratio"],
  ["Glucose", "mmol/L", null, "glucose"],
  ["Total Cholesterol", "mmol/L", "blood", "total_cholesterol"],
  ["Total Chol", "mmol/L", "blood", "total_cholesterol"],
  ["HDL-Cholesterol", "mmol/L", "blood", "hdl_c"],
  ["HDL-C", "mmol/L", "blood", "hdl_c"],
  ["Non HDL-C", "mmol/L", "blood", "non_hdl_c"],
  ["Non-HDL", "mmol/L", "blood", "non_hdl_c"],
  ["Total CHOL/HDL", "Ratio", "blood", "tc_hdl_ratio"],
  ["T Chol/HDL ratio", null, "blood", "tc_hdl_ratio"],
  ["AIP", null, "blood", "aip"],
  ["eGFR", "ml/min/1.73m^2", "blood", "egfr"],
  ["eGFR", "mL/min/1.73m²", "blood", "egfr"],
  ["Carbon Dioxide", "mmol/L", "blood", "bicarbonate"],
  ["Uric Acid", "umol/L", "blood", "uric_acid"],
  ["Uric Acid", "mmol/L", "blood", "uric_acid"],
  ["Phosphorus", "mmol/L", "blood", "phosphate"],
  ["Phosphate", "mmol/L", "blood", "phosphate"],
  ["A/G Ratio", "Ratio", "blood", "ag_ratio"],
  ["Albumin/Globulin ratio", null, "blood", "ag_ratio"],
  ["Alk. Phos", "IU/L", "blood", "alp"],
  ["Alkaline Phosphatase", "U/L", "blood", "alp"],
  ["ALT (SGPT)", "IU/L", "blood", "alt"],
  ["Total Bilirubin", "umol/L", "blood", "total_bilirubin"],
  ["HbA1c (NGSP)", "%", "blood", "hba1c"],
  ["HbA1c", "%", "blood", "hba1c"],
  ["HbA1c", "mmol/mol", "blood", "hba1c_ifcc"],
  ["25-Hydroxy Vitamin D", "nmol/L", "blood", "vitamin_d"],
  ["Follicle Stimulating Hormone", "mIU/mL", "blood", "fsh"],
  ["Transparency", null, "urine", "urine_transparency"],
  ["SG", null, "urine", "urine_sg"],
  ["pH", null, "urine", "urine_ph"],
  ["Leucocytes", null, "urine", "urine_leucocytes"],
  ["Leucocytes", "x 10^6/L", "urine", "urine_wbc_micro"],
  ["Erythrocytes", "x 10^6/L", "urine", "urine_rbc_micro"],
  ["Glucose", null, "urine", "urine_glucose"],
  ["Bilirubin", null, "urine", "urine_bilirubin"],
  ["Protein", null, "urine", "urine_protein"],
];

Deno.test("both laboratories' printed names match the right analyte", () => {
  for (const [name, unit, specimen, expected] of PRINTED) {
    assertEquals(
      analyteOf(name, unit, specimen),
      expected,
      `${name} [${unit}]`,
    );
  }
});

Deno.test("unit decides between same-named tests when specimen is unknown", () => {
  assertEquals(analyteOf("Glucose", "mmol/L"), "glucose");
  assertEquals(analyteOf("Glucose", null), "urine_glucose");
  assertEquals(analyteOf("Bilirubin", "umol/L"), "total_bilirubin");
  assertEquals(analyteOf("Bilirubin", null), "urine_bilirubin");
});

Deno.test("conversion factors come from the catalog", () => {
  const factor = (name: string, unit: string) => {
    const match = find(name, unit, "blood");
    return match.kind === "mapped" ? match.factor : NaN;
  };
  assertEquals(factor("Haemoglobin", "g/L"), 0.1);
  assertEquals(factor("PCV", "L/L"), 100);
  assertEquals(factor("Uric Acid", "mmol/L"), 1000);
  assertEquals(factor("Haemoglobin", "g/dL"), 1);
});

Deno.test("unknown names, units and specimens stay unmapped with a reason", () => {
  const reason = (match: ReturnType<typeof find>) =>
    match.kind === "unmapped" ? match.reason : "mapped";
  assertEquals(
    reason(find("Mystery Test", "mmol/L")),
    '"Mystery Test" is not in the catalog',
  );
  assertEquals(
    reason(find("Haemoglobin", "mmol/L", "blood")),
    'unit "mmol/L" is not accepted by haemoglobin',
  );
  assertEquals(
    reason(find("Haemoglobin", "g/dL", "urine")),
    'catalog knows "Haemoglobin" only as a blood test, not urine',
  );
});

Deno.test("the catalog rejects a name that could match two analytes", () => {
  const ambiguous: Catalog = {
    analytes: [
      {
        id: "a",
        name: "A",
        specimen: "blood",
        unit: "mmol/L",
        aliases: ["X"],
        units: { "mmol/L": 1 },
      },
      {
        id: "b",
        name: "B",
        specimen: "blood",
        unit: "mmol/L",
        aliases: ["x"],
        units: { "mmol/L": 1 },
      },
    ],
  };
  assertThrows(() => indexCatalog(ambiguous), Error, "ambiguous");
});

Deno.test("the catalog requires each analyte's own unit at factor 1", () => {
  const broken: Catalog = {
    analytes: [
      {
        id: "a",
        name: "A",
        specimen: "blood",
        unit: "g/dL",
        aliases: ["A"],
        units: { "g/L": 0.1 },
      },
    ],
  };
  assertThrows(() => indexCatalog(broken), Error, "factor 1");
});

Deno.test("analytes.json is in the canonical format", async () => {
  assertEquals(
    formatCatalog(index.catalog),
    await Deno.readTextFile(DEFAULT_CATALOG),
  );
});

Deno.test("the catalog hash depends on content, not formatting", async () => {
  const text = await Deno.readTextFile(DEFAULT_CATALOG);
  const fromFile = await loadCatalog();
  const reformatted = JSON.parse(JSON.stringify(JSON.parse(text), null, 8));
  assertEquals((await catalogFromJson(reformatted)).hash, fromFile.hash);

  const changed = structuredClone(index.catalog);
  changed.analytes[0].aliases.push("Another Name");
  assertEquals((await catalogFromJson(changed)).hash !== fromFile.hash, true);
});
