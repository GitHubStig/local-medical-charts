/**
 * Turns per-page model output into one normalized Report.
 *
 * Everything here is deterministic: the model transcribes, this file
 * interprets. Values that don't fit a known shape degrade to text rather than
 * being dropped or guessed at.
 */
import type {
  PageExtraction,
  Range,
  RawTest,
  Report,
  Result,
  Test,
} from "./schema.ts";

const NUMBER = String.raw`-?\d+(?:\.\d+)?`;

/** A printed result: a number, a number behind an operator, or free text. */
export function parseResult(raw: string): Result {
  const text = raw.trim().replace(/\s+/g, " ");

  const comparator = text.match(new RegExp(`^(<=|>=|<|>)\\s*(${NUMBER})$`));
  if (comparator) {
    return {
      kind: "comparator",
      op: comparator[1] as "<" | "<=" | ">" | ">=",
      value: Number(comparator[2]),
    };
  }

  if (new RegExp(`^${NUMBER}$`).test(text)) {
    return { kind: "numeric", value: Number(text) };
  }

  return { kind: "text", text };
}

/**
 * Only plain min–max and single-operator ranges are structured. Banded and
 * conditional ranges stay text — `rangeText` keeps the printed form either way.
 */
export function parseRange(text: string | null): Range | null {
  if (text === null) return null;
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean === "") return null;

  const between = clean.match(
    new RegExp(`^(${NUMBER})\\s*(?:-|–|to)\\s*(${NUMBER})$`),
  );
  if (between) {
    return {
      kind: "between",
      min: Number(between[1]),
      max: Number(between[2]),
    };
  }

  const bounded = clean.match(new RegExp(`^(<=|>=|<|>)\\s*(${NUMBER})$`));
  if (bounded) {
    const inclusive = bounded[1].endsWith("=");
    const limit = Number(bounded[2]);
    return bounded[1].startsWith("<")
      ? { kind: "below", limit, inclusive }
      : { kind: "above", limit, inclusive };
  }

  return { kind: "text", text: clean };
}

/** `02/03/2026 09:04:00` or `15-08-1990` → ISO. Dates are printed D/M/Y. */
export function parseDate(printed: string | null): string | null {
  if (printed === null) return null;
  const match = printed.trim().match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;

  const [, day, month, year, hour, minute, second] = match;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (hour === undefined) return date;
  return `${date}T${hour.padStart(2, "0")}:${minute}:${second ?? "00"}`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * A stable identifier to chart on across reports: the test name plus, for
 * two-line differentials, which line it came from.
 */
export function testKey(test: RawTest, taken: Set<string>): string {
  const suffix = test.component === "percent"
    ? "_pct"
    : test.component === "absolute"
    ? "_abs"
    : "";
  const base = slug(test.name) + suffix;

  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  // Same name twice on one report: separate them by unit, then by count.
  const byUnit = test.unit ? `${base}_${slug(test.unit)}` : base;
  if (byUnit !== base && !taken.has(byUnit)) {
    taken.add(byUnit);
    return byUnit;
  }
  for (let n = 2;; n++) {
    const candidate = `${byUnit}_${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

function normalizeTest(raw: RawTest, page: number, taken: Set<string>): Test {
  return {
    key: testKey(raw, taken),
    name: raw.name,
    nameZh: raw.nameZh,
    panel: raw.panel,
    component: raw.component,
    flag: raw.flag,
    result: parseResult(raw.value),
    raw: raw.value,
    unit: raw.unit,
    range: parseRange(raw.referenceText),
    rangeText: raw.referenceText,
    notes: raw.notes,
    page,
  };
}

type HeaderPath = readonly [keyof PageExtraction, string];

/**
 * Header fields repeat on every page. Take the value the pages agree on, and
 * warn rather than fail when they don't — a single misread character on one
 * page shouldn't sink the report.
 */
function reconcile(
  pages: PageExtraction[],
  [section, field]: HeaderPath,
  warnings: string[],
): string | null {
  const seen = new Map<string, number[]>();
  for (const page of pages) {
    const group = page[section] as Record<string, string | null>;
    const value = group?.[field];
    if (value === null || value === undefined || value === "") continue;
    const pageNumbers = seen.get(value) ?? [];
    pageNumbers.push(page.page);
    seen.set(value, pageNumbers);
  }

  if (seen.size === 0) return null;

  const ranked = [...seen.entries()].sort((a, b) => b[1].length - a[1].length);
  if (ranked.length > 1) {
    const detail = ranked
      .map(([value, pageNumbers]) => `"${value}" (p${pageNumbers.join(",")})`)
      .join(" vs ");
    warnings.push(
      `${section}.${field} differs between pages: ${detail} — used "${
        ranked[0][0]
      }"`,
    );
  }
  return ranked[0][0];
}

function section<T extends Record<string, string | null>>(
  pages: PageExtraction[],
  name: keyof PageExtraction,
  fields: readonly string[],
  warnings: string[],
): T {
  const out: Record<string, string | null> = {};
  for (const field of fields) {
    out[field] = reconcile(pages, [name, field], warnings);
  }
  return out as T;
}

export function buildReport(
  pages: PageExtraction[],
  meta: Report["source"],
): Report {
  const warnings: string[] = [];
  const ordered = [...pages].sort((a, b) => a.page - b.page);

  for (const page of ordered) {
    for (const warning of page.warnings) {
      warnings.push(`p${page.page}: ${warning}`);
    }
  }

  const taken = new Set<string>();
  const tests: Test[] = [];
  for (const page of ordered) {
    // Resolved before this page's own rows are added: text carried over at the
    // top of a page belongs to the last test of the *previous* page, even when
    // this page goes on to print tests of its own.
    const carriedOverTo = tests.at(-1);

    for (const raw of page.tests) {
      tests.push(normalizeTest(raw, page.page, taken));
    }

    if (page.continuationText) {
      const previous = carriedOverTo;
      if (previous) {
        previous.rangeText = [previous.rangeText, page.continuationText]
          .filter(Boolean)
          .join("; ");
        previous.range = parseRange(previous.rangeText);
        warnings.push(
          `p${page.page}: reference range continued from the previous page, appended to "${previous.name}"`,
        );
      } else {
        warnings.push(
          `p${page.page}: continuation text with no preceding test: ${page.continuationText}`,
        );
      }
    }
  }

  const patient = section<Report["patient"]>(ordered, "patient", [
    "name",
    "recordNumber",
    "dateOfBirth",
    "idNumber",
    "age",
    "sex",
    "comment",
  ], warnings);
  const encounter = section<Report["encounter"]>(ordered, "encounter", [
    "visitNumber",
    "sampleId",
    "dateRequested",
    "dateReceived",
    "packageName",
  ], warnings);

  const expected = ordered[0]?.pageCount;
  if (expected && expected !== ordered.length) {
    warnings.push(
      `report says ${expected} pages but ${ordered.length} image(s) were extracted`,
    );
  }

  return {
    source: meta,
    lab: section(ordered, "lab", [
      "name",
      "department",
      "address",
      "phone",
      "email",
      "website",
    ], warnings),
    patient: {
      ...patient,
      dateOfBirthIso: parseDate(patient.dateOfBirth),
    },
    doctor: section(ordered, "doctor", [
      "name",
      "location",
      "roomNumber",
    ], warnings),
    encounter: {
      ...encounter,
      dateRequestedIso: parseDate(encounter.dateRequested),
      dateReceivedIso: parseDate(encounter.dateReceived),
    },
    validation: section(ordered, "validation", [
      "validatedBy",
      "printedOn",
    ], warnings),
    tests,
    warnings,
  };
}
