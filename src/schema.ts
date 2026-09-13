/**
 * Schemas for lab-report extraction, in two layers:
 *
 *   PageExtraction — what the vision model returns for one page. Deliberately
 *                    close to what is printed: values, units and reference
 *                    ranges stay verbatim strings, whatever the laboratory.
 *   Report         — the normalized merge of a report's pages, produced in
 *                    code, with each result matched to the analyte catalog so
 *                    results from different laboratories chart together.
 *
 * The model's job stops at transcription. Parsing, flag derivation, unit
 * conversion and deciding which tests are the same test all happen in code.
 */
import { z } from "@zod/zod";

const text = () => z.string().nullable();

export const SpecimenSchema = z.enum(["blood", "urine", "stool", "other"]);

/** H/L when the direction is known; A for abnormal with no direction. */
export const FlagSchema = z.enum(["H", "L", "A"]);

export const ComparatorSchema = z.enum(["<", "<=", ">", ">="]);

// ---------------------------------------------------------------------------
// Layer 1: what the model returns
// ---------------------------------------------------------------------------

/** One printed result. A row can print several: %, absolute, a second unit. */
export const RawMeasurementSchema = z.object({
  /** The result exactly as printed, operators and trailing zeros intact. */
  value: z.string(),
  unit: text(),
  /** This result's reference range as printed, parentheses included. */
  referenceText: text(),
  /** Abnormal marker as printed: "H", "L", "*", … */
  marker: text(),
});

export const RawTestSchema = z.object({
  /** Section headings above the row, outermost first. */
  headings: z.array(z.string()),
  specimen: SpecimenSchema.nullable(),
  name: z.string(),
  /** Chinese test name printed beside the English one. */
  nameZh: text(),
  measurements: z.array(RawMeasurementSchema).min(1),
  /** Footnotes attached to this row. */
  notes: z.array(z.string()),
});

/** A labelled header value with no fixed slot, e.g. "Lab No.", "R/N". */
export const HeaderFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const PageExtractionSchema = z.object({
  page: z.number().int(),
  pageCount: z.number().int(),
  provider: z.object({
    name: text(),
    address: text(),
    phone: text(),
    website: text(),
  }),
  patient: z.object({
    name: text(),
    idNumber: text(),
    dateOfBirth: text(),
    sex: text(),
    age: text(),
  }),
  doctor: z.object({
    name: text(),
    clinic: text(),
  }),
  /** Filled by label meaning only — a "Collected" date is never "received". */
  dates: z.object({
    collected: text(),
    received: text(),
    requested: text(),
    reported: text(),
  }),
  headerFields: z.array(HeaderFieldSchema),
  tests: z.array(RawTestSchema),
  /** The rest of a reference range for a test printed on the previous page. */
  continuationText: text(),
  /** Guideline, cut-off and risk tables, references, method notes. */
  interpretation: z.array(z.string()),
  /** Specimen comments and fasting status, e.g. "Haemolysis +". */
  specimenNotes: z.array(z.string()),
  /** The model's own notes about anything it could not read confidently. */
  warnings: z.array(z.string()),
});

/** A cached page: the model's extraction plus how it was produced. */
export const PageFileSchema = z.object({
  model: z.string(),
  promptHash: z.string(),
  extractedAt: z.string(),
  extraction: PageExtractionSchema,
});

// ---------------------------------------------------------------------------
// Layer 2: the normalized report
// ---------------------------------------------------------------------------

export const ResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numeric"), value: z.number() }),
  z.object({
    kind: z.literal("comparator"),
    op: ComparatorSchema,
    value: z.number(),
  }),
  z.object({ kind: z.literal("text"), text: z.string() }),
]);

/**
 * Plain numeric and single-bound ranges are structured, as are one-word
 * qualitative expectations like "Negative". Banded and conditional ranges
 * (diabetes cut-offs, hormone phases) stay text; `printed.referenceText` always
 * keeps the original.
 */
export const RangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("between"), min: z.number(), max: z.number() }),
  z.object({
    kind: z.literal("below"),
    limit: z.number(),
    inclusive: z.boolean(),
  }),
  z.object({
    kind: z.literal("above"),
    limit: z.number(),
    inclusive: z.boolean(),
  }),
  z.object({ kind: z.literal("qualitative"), expected: z.string() }),
  z.object({ kind: z.literal("text"), text: z.string() }),
]);

export const TestSchema = z.object({
  /** Catalog analyte id — the key to chart on. Null until the name is mapped. */
  analyte: text(),
  analyteName: text(),
  specimen: SpecimenSchema.nullable(),
  name: z.string(),
  nameZh: text(),
  headings: z.array(z.string()),
  result: ResultSchema,
  /** The printed unit, spelling normalized. */
  unit: text(),
  range: RangeSchema.nullable(),
  flag: FlagSchema.nullable(),
  /** "printed" when the lab printed the flag; "derived" when worked out here. */
  flagSource: z.enum(["printed", "derived"]).nullable(),
  /** The result converted to the analyte's catalog unit. Plot this. */
  standard: z.object({
    op: ComparatorSchema.nullable(),
    value: z.number(),
    unit: text(),
  }).nullable(),
  printed: RawMeasurementSchema,
  notes: z.array(z.string()),
  page: z.number().int(),
});

export const UnmappedSchema = z.object({
  name: z.string(),
  nameZh: text(),
  specimen: SpecimenSchema.nullable(),
  unit: text(),
  reason: z.string(),
  pages: z.array(z.number().int()),
});

export const DateSourceSchema = z.enum([
  "collected",
  "received",
  "requested",
  "reported",
]);

export const ReportSchema = z.object({
  source: z.object({
    report: z.string(),
    images: z.array(z.string()),
    pages: z.number().int(),
    model: z.string(),
    promptHash: z.string(),
    catalogHash: z.string(),
    extractedAt: z.string(),
    mergedAt: z.string(),
  }),
  provider: PageExtractionSchema.shape.provider,
  patient: PageExtractionSchema.shape.patient.extend({
    dateOfBirthIso: text(),
  }),
  doctor: PageExtractionSchema.shape.doctor,
  dates: PageExtractionSchema.shape.dates,
  /** When the specimen was taken — the x-axis for charts. */
  collectedAt: text(),
  /** Which printed date `collectedAt` came from. */
  collectedAtSource: DateSourceSchema.nullable(),
  reportedAt: text(),
  headerFields: z.array(HeaderFieldSchema),
  specimenNotes: z.array(z.string()),
  interpretation: z.array(
    z.object({ page: z.number().int(), text: z.string() }),
  ),
  tests: z.array(TestSchema),
  /** Distinct test names the catalog could not match. See `deno task map`. */
  unmapped: z.array(UnmappedSchema),
  warnings: z.array(z.string()),
});

export type Specimen = z.infer<typeof SpecimenSchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type Comparator = z.infer<typeof ComparatorSchema>;
export type RawMeasurement = z.infer<typeof RawMeasurementSchema>;
export type RawTest = z.infer<typeof RawTestSchema>;
export type HeaderField = z.infer<typeof HeaderFieldSchema>;
export type PageExtraction = z.infer<typeof PageExtractionSchema>;
export type PageFile = z.infer<typeof PageFileSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Range = z.infer<typeof RangeSchema>;
export type Test = z.infer<typeof TestSchema>;
export type Unmapped = z.infer<typeof UnmappedSchema>;
export type DateSource = z.infer<typeof DateSourceSchema>;
export type Report = z.infer<typeof ReportSchema>;
