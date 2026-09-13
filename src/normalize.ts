/**
 * Turns per-page model output into one normalized Report.
 *
 * Everything here is deterministic: the model transcribes, this file
 * interprets, and the analyte catalog decides which tests are the same test.
 * Values that don't fit a known shape degrade to text rather than being
 * dropped or guessed at.
 */
import { type CatalogIndex, lookup, nameKey } from "./catalog.ts";
import type {
  Comparator,
  DateSource,
  Flag,
  PageExtraction,
  Range,
  RawMeasurement,
  RawTest,
  Report,
  ReportPage,
  Result,
  Test,
  Unmapped,
} from "./schema.ts";
import { SCHEMA_VERSION } from "./schema.ts";
import { normalizeUnit } from "./units.ts";

const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const COMPARATOR = String.raw`<=|>=|≤|≥|<|>`;

function toComparator(symbol: string): Comparator {
  if (symbol === "≤") return "<=";
  if (symbol === "≥") return ">=";
  return symbol as Comparator;
}

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** `(120-150)` → `120-150`, leaving `(a) or (b)` alone. */
function unwrap(text: string): string {
  let s = text.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    const inner = s.slice(1, -1);
    let depth = 0;
    for (const char of inner) {
      if (char === "(") depth++;
      if (char === ")" && --depth < 0) break;
    }
    if (depth !== 0) break;
    s = inner.trim();
  }
  return s;
}

/** Drops a unit repeated after the number: `5.7-6.2%` → `5.7-6.2`. */
function stripUnit(text: string, unit: string | null): string {
  const target = normalizeUnit(unit);
  if (target === null) return text;
  for (let i = 1; i < text.length; i++) {
    const head = text.slice(0, i);
    const tail = text.slice(i).trim();
    if (tail !== "" && /\d\s*$/.test(head) && normalizeUnit(tail) === target) {
      return head.trim();
    }
  }
  return text;
}

/** A printed result: a number, a number behind an operator, or words. */
export function parseResult(raw: string, unit: string | null = null): Result {
  const text = stripUnit(unwrap(collapse(raw)), unit);

  const comparator = text.match(new RegExp(`^(${COMPARATOR})\\s*(${NUMBER})$`));
  if (comparator) {
    return {
      kind: "comparator",
      op: toComparator(comparator[1]),
      value: Number(comparator[2]),
    };
  }
  if (new RegExp(`^${NUMBER}$`).test(text)) {
    return { kind: "numeric", value: Number(text) };
  }
  return { kind: "text", text };
}

export function parseRange(
  text: string | null,
  unit: string | null = null,
): Range | null {
  if (text === null) return null;
  const printed = unwrap(
    unwrap(collapse(text)).replace(/^ref\.?\s*ranges?\s*:?\s*/i, ""),
  );
  if (printed === "") return null;
  const s = stripUnit(printed, unit);

  const between = s.match(
    new RegExp(`^(${NUMBER})\\s*(?:-|–|—|to)\\s*(${NUMBER})$`, "i"),
  );
  if (between) {
    return {
      kind: "between",
      min: Number(between[1]),
      max: Number(between[2]),
    };
  }

  const bounded = s.match(new RegExp(`^(${COMPARATOR})\\s*(${NUMBER})$`));
  if (bounded) {
    const op = toComparator(bounded[1]);
    const limit = Number(bounded[2]);
    const inclusive = op.endsWith("=");
    return op.startsWith("<")
      ? { kind: "below", limit, inclusive }
      : { kind: "above", limit, inclusive };
  }

  if (s.length <= 40 && /^[a-z][a-z .'-]*$/i.test(s)) {
    return { kind: "qualitative", expected: s };
  }

  return { kind: "text", text: printed };
}

/**
 * `14/01/2025 08:30:00`, `15-08-1990`, `14/01/25 08:30` → ISO. Dates are read
 * day-first. A two-digit year later than next year is taken as the 1900s, so a
 * birth year of `90` is 1990.
 */
export function parseDate(
  printed: string | null,
  today = new Date(),
): string | null {
  if (printed === null) return null;
  const match = collapse(printed).match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(?:h|hrs?)?)?$/i,
  );
  if (!match) return null;

  const [, d, m, y, hh, mm, ss] = match;
  const day = Number(d);
  const month = Number(m);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let year = Number(y);
  if (y.length === 2) {
    const pivot = (today.getFullYear() % 100) + 1;
    year += year <= pivot ? 2000 : 1900;
  }

  const date = `${year}-${String(month).padStart(2, "0")}-${
    String(day).padStart(2, "0")
  }`;
  if (hh === undefined) return date;
  if (Number(hh) > 23 || Number(mm) > 59) return date;
  return `${date}T${hh.padStart(2, "0")}:${mm}:${ss ?? "00"}`;
}

/**
 * Where a result sits against its range. A comparator result (`< 3`) only
 * bounds the true value, so it is classified only when the bound settles it.
 */
export function classify(
  result: Result,
  range: Range | null,
): Flag | "normal" | null {
  if (range === null || range.kind === "text") return null;

  if (range.kind === "qualitative") {
    if (result.kind !== "text") return null;
    return result.text.toLowerCase() === range.expected.toLowerCase()
      ? "normal"
      : "A";
  }

  if (result.kind === "text") return null;

  if (result.kind === "numeric") {
    const v = result.value;
    if (range.kind === "between") {
      return v < range.min ? "L" : v > range.max ? "H" : "normal";
    }
    if (range.kind === "below") {
      return (range.inclusive ? v <= range.limit : v < range.limit)
        ? "normal"
        : "H";
    }
    return (range.inclusive ? v >= range.limit : v > range.limit)
      ? "normal"
      : "L";
  }

  const { op, value: v } = result;
  const atMost = op === "<" || op === "<=";
  const strict = op === "<" || op === ">";

  if (range.kind === "between") {
    if (atMost) {
      if (v < range.min || (strict && v === range.min)) return "L";
      return range.min <= 0 && v <= range.max ? "normal" : null;
    }
    return v > range.max || (strict && v === range.max) ? "H" : null;
  }
  if (range.kind === "below") {
    if (atMost) {
      return v < range.limit ||
          (v === range.limit && (strict || range.inclusive))
        ? "normal"
        : null;
    }
    return v > range.limit ||
        (v === range.limit && (strict || !range.inclusive))
      ? "H"
      : null;
  }
  if (atMost) {
    return v < range.limit ||
        (v === range.limit && (strict || !range.inclusive))
      ? "L"
      : null;
  }
  return v > range.limit || (v === range.limit && (strict || range.inclusive))
    ? "normal"
    : null;
}

/**
 * A printed H/L always wins. Other markers (`*`, underlining) say "abnormal"
 * without a direction, which the range supplies when it can. With no marker, a
 * result outside a structured range is still flagged, as "derived".
 */
export function deriveFlag(
  marker: string | null,
  result: Result,
  range: Range | null,
): {
  flag: Flag | null;
  source: "printed" | "derived" | null;
  warning: string | null;
} {
  const printed = marker?.trim().toUpperCase() ?? "";
  if (/^H+$/.test(printed)) {
    return { flag: "H", source: "printed", warning: null };
  }
  if (/^L+$/.test(printed)) {
    return { flag: "L", source: "printed", warning: null };
  }

  const found = classify(result, range);
  if (found !== null && found !== "normal") {
    return { flag: found, source: "derived", warning: null };
  }
  if (printed === "") return { flag: null, source: null, warning: null };

  return {
    flag: "A",
    source: "printed",
    warning: found === "normal"
      ? `is marked "${marker?.trim()}" but falls within its reference range`
      : null,
  };
}

function round(value: number): number {
  return Number(value.toPrecision(12));
}

function applyRange(test: Test, warnings: string[]) {
  test.range = parseRange(test.printed.referenceText, test.printed.unit);
  const { flag, source, warning } = deriveFlag(
    test.printed.marker,
    test.result,
    test.range,
  );
  test.flag = flag;
  test.flagSource = source;
  if (warning) warnings.push(`p${test.page}: ${test.name} ${warning}`);
}

function toTest(
  raw: RawTest,
  measurement: RawMeasurement,
  page: number,
  catalog: CatalogIndex,
  unmapped: Map<string, Unmapped>,
  warnings: string[],
): Test {
  const unit = normalizeUnit(measurement.unit);
  const result = parseResult(measurement.value, measurement.unit);
  const test: Test = {
    analyte: null,
    analyteName: null,
    specimen: raw.specimen,
    name: raw.name,
    nameZh: raw.nameZh,
    headings: raw.headings,
    result,
    unit,
    range: null,
    flag: null,
    flagSource: null,
    standard: null,
    printed: measurement,
    notes: raw.notes,
    page,
  };

  const match = lookup(catalog, {
    name: raw.name,
    specimen: raw.specimen,
    unit,
  });
  if (match.kind === "mapped") {
    test.analyte = match.analyte.id;
    test.analyteName = match.analyte.name;
    test.specimen = match.analyte.specimen;
    if (result.kind !== "text") {
      test.standard = {
        op: result.kind === "comparator" ? result.op : null,
        value: round(result.value * match.factor),
        unit: match.analyte.unit === "" ? null : match.analyte.unit,
      };
    }
  } else {
    const key = `${nameKey(raw.name)}|${raw.specimen ?? ""}|${unit ?? ""}`;
    const entry = unmapped.get(key) ?? {
      name: raw.name,
      nameZh: raw.nameZh,
      specimen: raw.specimen,
      unit,
      reason: match.reason,
      pages: [],
    };
    if (!entry.pages.includes(page)) entry.pages.push(page);
    unmapped.set(key, entry);
  }

  applyRange(test, warnings);
  return test;
}

type Reading = { value: string; page: number };

/**
 * The value most pages agree on. Disagreements are warned about; for
 * personal fields the warning names only the pages, never the values.
 */
function majority(
  readings: Reading[],
  label: string,
  warnings: string[],
  personal: boolean,
): string | null {
  const byValue = new Map<string, number[]>();
  for (const { value, page } of readings) {
    const v = collapse(value);
    if (v) byValue.set(v, [...(byValue.get(v) ?? []), page]);
  }
  if (byValue.size === 0) return null;

  const ranked = [...byValue.entries()].sort((a, b) =>
    b[1].length - a[1].length
  );
  if (ranked.length > 1) {
    const detail = ranked
      .map(([value, pages]) =>
        personal ? `p${pages.join(",")}` : `"${value}" (p${pages.join(",")})`
      )
      .join(" vs ");
    warnings.push(
      `${label} differs between pages: ${detail} — used the most common reading`,
    );
  }
  return ranked[0][0];
}

function reconcile<K extends string>(
  pages: PageExtraction[],
  label: string,
  keys: readonly K[],
  pick: (page: PageExtraction) => Record<K, string | null>,
  warnings: string[],
  personal: boolean,
): Record<K, string | null> {
  const out = {} as Record<K, string | null>;
  for (const key of keys) {
    const readings = pages.flatMap((page) => {
      const value = pick(page)[key];
      return value ? [{ value, page: page.page }] : [];
    });
    out[key] = majority(readings, `${label}.${key}`, warnings, personal);
  }
  return out;
}

function dedupe(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const clean = collapse(value);
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.set(clean.toLowerCase(), clean);
    }
  }
  return [...seen.values()];
}

const DATE_PRIORITY: readonly DateSource[] = [
  "collected",
  "received",
  "requested",
  "reported",
];

/** What a merge needs beyond the pages; the rest of `source` is derived. */
export type MergeInfo = Pick<
  Report["source"],
  "report" | "catalogHash" | "mergedAt"
>;

function distinct(values: string[]): string {
  return [...new Set(values)].join(", ");
}

/**
 * Merges a report's pages into one normalized Report, matching every result
 * against the catalog. Deterministic: the same pages and catalog always give the
 * same report, which is what lets stored reports be re-merged later.
 */
export function buildReport(
  pages: ReportPage[],
  info: MergeInfo,
  catalog: CatalogIndex,
): Report {
  const warnings: string[] = [];
  const sortedPages = [...pages].sort((a, b) =>
    a.extraction.page - b.extraction.page
  );
  const ordered = sortedPages.map((p) => p.extraction);

  for (const page of ordered) {
    for (const warning of page.warnings) {
      warnings.push(`p${page.page}: ${warning}`);
    }
  }

  const unmapped = new Map<string, Unmapped>();
  const tests: Test[] = [];
  const interpretation: Report["interpretation"] = [];
  const seenInterpretation = new Set<string>();

  for (const page of ordered) {
    // Resolved before this page's rows are added: carried-over text belongs to
    // the last result of the previous page, even when this page has its own.
    const carriedOverTo = tests.at(-1);

    for (const raw of page.tests) {
      for (const measurement of raw.measurements) {
        tests.push(
          toTest(raw, measurement, page.page, catalog, unmapped, warnings),
        );
      }
    }

    if (page.continuationText) {
      if (carriedOverTo) {
        carriedOverTo.printed = {
          ...carriedOverTo.printed,
          referenceText: [
            carriedOverTo.printed.referenceText,
            page.continuationText,
          ].filter(Boolean).join("; "),
        };
        applyRange(carriedOverTo, warnings);
        warnings.push(
          `p${page.page}: reference range continued from the previous page, appended to "${carriedOverTo.name}"`,
        );
      } else {
        warnings.push(
          `p${page.page}: continuation text with no preceding result`,
        );
      }
    }

    for (const block of page.interpretation) {
      const text = collapse(block);
      if (text && !seenInterpretation.has(text.toLowerCase())) {
        seenInterpretation.add(text.toLowerCase());
        interpretation.push({ page: page.page, text });
      }
    }
  }

  const provider = reconcile(
    ordered,
    "provider",
    ["name", "address", "phone", "website"] as const,
    (p) => p.provider,
    warnings,
    false,
  );
  const patient = reconcile(
    ordered,
    "patient",
    ["name", "idNumber", "dateOfBirth", "sex", "age"] as const,
    (p) => p.patient,
    warnings,
    true,
  );
  const doctor = reconcile(
    ordered,
    "doctor",
    ["name", "clinic"] as const,
    (p) => p.doctor,
    warnings,
    true,
  );
  const dates = reconcile(
    ordered,
    "dates",
    DATE_PRIORITY,
    (p) => p.dates,
    warnings,
    true,
  );

  const labels = new Map<string, { label: string; readings: Reading[] }>();
  for (const page of ordered) {
    for (const field of page.headerFields) {
      const key = nameKey(field.label);
      if (!key) continue;
      const entry = labels.get(key) ??
        { label: collapse(field.label), readings: [] };
      entry.readings.push({ value: field.value, page: page.page });
      labels.set(key, entry);
    }
  }
  const headerFields = [...labels.values()].flatMap(({ label, readings }) => {
    const value = majority(readings, `header "${label}"`, warnings, true);
    return value ? [{ label, value }] : [];
  });

  let collectedAt: string | null = null;
  let collectedAtSource: DateSource | null = null;
  for (const key of DATE_PRIORITY) {
    const iso = parseDate(dates[key]);
    if (iso) {
      collectedAt = iso;
      collectedAtSource = key;
      break;
    }
    if (dates[key]) {
      warnings.push(
        `dates.${key} could not be parsed (printed as ${
          dates[key]!.replace(/\d/g, "9")
        })`,
      );
    }
  }
  if (collectedAtSource && collectedAtSource !== "collected") {
    warnings.push(
      `no collection date printed; charting by the ${collectedAtSource} date`,
    );
  }

  const printedCount = ordered.find((p) => p.pageCount > 0)?.pageCount;
  if (printedCount && printedCount !== ordered.length) {
    warnings.push(
      `report says ${printedCount} pages but ${ordered.length} image(s) were extracted`,
    );
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    source: {
      report: info.report,
      images: sortedPages.map((p) => p.image),
      pages: sortedPages.length,
      model: distinct(sortedPages.map((p) => p.model)),
      promptHash: distinct(sortedPages.map((p) => p.promptHash)),
      catalogHash: info.catalogHash,
      extractedAt: sortedPages.map((p) => p.extractedAt).sort().at(-1) ?? "",
      mergedAt: info.mergedAt,
    },
    provider,
    patient: { ...patient, dateOfBirthIso: parseDate(patient.dateOfBirth) },
    doctor,
    dates,
    collectedAt,
    collectedAtSource,
    reportedAt: parseDate(dates.reported),
    headerFields,
    specimenNotes: dedupe(ordered.flatMap((p) => p.specimenNotes)),
    interpretation,
    tests,
    unmapped: [...unmapped.values()],
    warnings,
    pages: sortedPages,
  };
}
