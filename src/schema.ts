/**
 * Schemas for lab-report extraction, in two layers:
 *
 *   PageExtraction — what the vision model is asked to return for one page.
 *                    Deliberately close to what is printed: values and
 *                    reference ranges stay verbatim strings.
 *   Report         — the normalized, chart-ready merge of a report's pages,
 *                    produced in code from the page extractions.
 *
 * Keeping the model's job to transcription (and doing every interpretation in
 * code) is what makes the output reproducible and testable.
 */
import { z } from "@zod/zod";

export const FlagSchema = z.enum(["H", "L"]);

/**
 * Which half of a two-line differential a row came from: the percentage line
 * or the parenthesized absolute-count line beneath it. Null for ordinary tests.
 */
export const ComponentSchema = z.enum(["percent", "absolute"]);

// ---------------------------------------------------------------------------
// Layer 1: what the model returns
// ---------------------------------------------------------------------------

export const RawTestSchema = z.object({
  /** Section heading the row sits under, e.g. "Full Blood Count". */
  panel: z.string().nullable(),
  name: z.string(),
  /** Chinese test name printed beside the English one. */
  nameZh: z.string().nullable(),
  component: ComponentSchema.nullable(),
  flag: FlagSchema.nullable(),
  /** Result exactly as printed, operators and trailing zeros intact. */
  value: z.string(),
  unit: z.string().nullable(),
  /** Reference-range column verbatim; multi-line ranges joined with "; ". */
  referenceText: z.string().nullable(),
  /** Footnotes attached to this row, e.g. the eGFR CKD-EPI note. */
  notes: z.array(z.string()),
});

export const PageExtractionSchema = z.object({
  page: z.number().int(),
  pageCount: z.number().int(),
  lab: z.object({
    name: z.string().nullable(),
    department: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    website: z.string().nullable(),
  }),
  patient: z.object({
    name: z.string().nullable(),
    recordNumber: z.string().nullable(),
    dateOfBirth: z.string().nullable(),
    idNumber: z.string().nullable(),
    age: z.string().nullable(),
    sex: z.string().nullable(),
    comment: z.string().nullable(),
  }),
  doctor: z.object({
    name: z.string().nullable(),
    location: z.string().nullable(),
    roomNumber: z.string().nullable(),
  }),
  encounter: z.object({
    visitNumber: z.string().nullable(),
    sampleId: z.string().nullable(),
    dateRequested: z.string().nullable(),
    dateReceived: z.string().nullable(),
    packageName: z.string().nullable(),
  }),
  validation: z.object({
    validatedBy: z.string().nullable(),
    printedOn: z.string().nullable(),
  }),
  tests: z.array(RawTestSchema),
  /**
   * Reference-range lines that belong to a test carried over from the previous
   * page. Page 5 of a 5-page report is often nothing but these.
   */
  continuationText: z.string().nullable(),
  /** The model's own notes about anything it could not read confidently. */
  warnings: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Layer 2: the normalized report
// ---------------------------------------------------------------------------

export const ResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numeric"), value: z.number() }),
  z.object({
    kind: z.literal("comparator"),
    op: z.enum(["<", "<=", ">", ">="]),
    value: z.number(),
  }),
  z.object({ kind: z.literal("text"), text: z.string() }),
]);

/**
 * Only plain numeric ranges are structured. Banded ranges (Glucose, HbA1c,
 * Vitamin D) and sex/phase-conditional ones (FSH, Estradiol) stay as text —
 * `rangeText` always holds what was printed, so nothing is lost.
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
  z.object({ kind: z.literal("text"), text: z.string() }),
]);

export const TestSchema = z.object({
  /** Stable slug for charting across reports, e.g. "neutrophils_pct". */
  key: z.string(),
  name: z.string(),
  nameZh: z.string().nullable(),
  panel: z.string().nullable(),
  component: ComponentSchema.nullable(),
  flag: FlagSchema.nullable(),
  result: ResultSchema,
  /** The result exactly as printed. */
  raw: z.string(),
  unit: z.string().nullable(),
  range: RangeSchema.nullable(),
  rangeText: z.string().nullable(),
  notes: z.array(z.string()),
  page: z.number().int(),
});

export const ReportSchema = z.object({
  source: z.object({
    report: z.string(),
    images: z.array(z.string()),
    pages: z.number().int(),
    model: z.string(),
    host: z.string(),
    promptHash: z.string(),
    extractedAt: z.string(),
  }),
  lab: PageExtractionSchema.shape.lab,
  patient: PageExtractionSchema.shape.patient.extend({
    dateOfBirthIso: z.string().nullable(),
  }),
  doctor: PageExtractionSchema.shape.doctor,
  encounter: PageExtractionSchema.shape.encounter.extend({
    dateRequestedIso: z.string().nullable(),
    dateReceivedIso: z.string().nullable(),
  }),
  validation: PageExtractionSchema.shape.validation,
  tests: z.array(TestSchema),
  warnings: z.array(z.string()),
});

export type RawTest = z.infer<typeof RawTestSchema>;
export type PageExtraction = z.infer<typeof PageExtractionSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Range = z.infer<typeof RangeSchema>;
export type Test = z.infer<typeof TestSchema>;
export type Report = z.infer<typeof ReportSchema>;

/**
 * JSON Schema for Ollama's `format`, which constrains decoding so the model
 * can only emit conforming JSON.
 *
 * Ollama's grammar conversion is happier with `type: [..., "null"]` than with
 * `anyOf`, and the huge integer bounds Zod emits are noise, so both are
 * rewritten here.
 */
export function pageExtractionJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(PageExtractionSchema, { target: "draft-7" });
  return simplify(schema) as Record<string, unknown>;
}

function simplify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplify);
  if (node === null || typeof node !== "object") return node;

  const obj = { ...node as Record<string, unknown> };

  // `X | null` as anyOf → a nullable type, keeping any enum values.
  const anyOf = obj.anyOf;
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const variants = anyOf as Record<string, unknown>[];
    const nullBranch = variants.find((v) => v.type === "null");
    const other = variants.find((v) => v.type !== "null");
    if (nullBranch && other && typeof other.type === "string") {
      delete obj.anyOf;
      Object.assign(obj, other, { type: [other.type, "null"] });
      if (Array.isArray(other.enum)) obj.enum = [...other.enum, null];
    }
  }

  if (obj.type === "integer" || obj.type === "number") {
    delete obj.minimum;
    delete obj.maximum;
  }

  for (const [key, value] of Object.entries(obj)) obj[key] = simplify(value);
  return obj;
}
