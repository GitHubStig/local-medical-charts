/**
 * The sections the dashboard groups tests into, in display order. Every analyte
 * in src/analytes.json names one. Kept free of imports so the app can use it.
 */
export const ANALYTE_GROUPS = [
  "Full blood count",
  "Lipids",
  "Renal & electrolytes",
  "Diabetes",
  "Liver",
  "Thyroid",
  "Hormones",
  "Vitamins",
  "Urinalysis",
  "Other",
] as const;

export type AnalyteGroup = (typeof ANALYTE_GROUPS)[number];
