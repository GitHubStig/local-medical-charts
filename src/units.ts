/**
 * Unit spelling normalization.
 *
 * Labs print the same unit many ways — `x10^9/L`, `x 10⁹/L`, `10^9/L` — and
 * vision models transcribe superscripts inconsistently. Units are compared on a
 * compact form and mapped to one display spelling.
 *
 * This is spelling only. Nothing here converts between different quantities;
 * that is the analyte catalog's job, with factors a person has written down.
 */

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

/** Compact form → display spelling. IU/L and U/L are the same unit. */
const SPELLINGS: Record<string, string> = {
  "x10^9/l": "x10^9/L",
  "10^9/l": "x10^9/L",
  "x10^12/l": "x10^12/L",
  "10^12/l": "x10^12/L",
  "x10^6/l": "x10^6/L",
  "10^6/l": "x10^6/L",
  "%": "%",
  "fl": "fL",
  "pg": "pg",
  "g/dl": "g/dL",
  "g/l": "g/L",
  "l/l": "L/L",
  "mg/dl": "mg/dL",
  "mmol/l": "mmol/L",
  "umol/l": "umol/L",
  "nmol/l": "nmol/L",
  "pmol/l": "pmol/L",
  "meq/l": "mEq/L",
  "u/l": "U/L",
  "iu/l": "U/L",
  "uiu/ml": "uIU/mL",
  "miu/l": "mIU/L",
  "miu/ml": "mIU/mL",
  "pg/ml": "pg/mL",
  "ng/ml": "ng/mL",
  "ng/dl": "ng/dL",
  "mmol/mol": "mmol/mol",
  "ml/min/1.73m^2": "mL/min/1.73m²",
  "ml/min/1.73m2": "mL/min/1.73m²",
};

/** Printed forms that mean "no unit". */
const DIMENSIONLESS = new Set(["", "ratio", "index", "-"]);

function compact(unit: string): string {
  return unit
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
      (digits) => "^" + [...digits].map((d) => SUPERSCRIPT_DIGITS[d]).join(""),
    )
    .replace(/[µμ]/g, "u")
    .replace(/×/g, "x")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** One display spelling per unit; null when the result has no unit. */
export function normalizeUnit(unit: string | null): string | null {
  if (unit === null) return null;
  const key = compact(unit);
  if (DIMENSIONLESS.has(key)) return null;
  return SPELLINGS[key] ?? unit.trim().replace(/\s+/g, " ");
}

/** Comparison key for a unit: "" when there is no unit. */
export function unitKey(unit: string | null): string {
  const normalized = normalizeUnit(unit);
  return normalized === null ? "" : compact(normalized);
}
