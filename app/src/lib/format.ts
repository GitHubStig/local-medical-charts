/**
 * Small display formatters shared by the screens. Plain functions, tested in
 * desktop/format_test.ts.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-03-18T08:40:00" → "Mar 2026". Read from the text, so time zones can't shift it. */
export function monthYear(iso: string | null): string | null {
  const match = iso?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : null;
}

/** "Nov 2024 – Mar 2026", or a single month when both fall in it. */
export function monthSpan(
  first: string | null,
  last: string | null,
): string | null {
  const from = monthYear(first);
  const to = monthYear(last);
  if (!from || !to) return from ?? to;
  return from === to ? from : `${from} – ${to}`;
}

/** Labs print names in capitals; show them in title case: "ALEX TAN" → "Alex Tan". */
export function displayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "Unnamed patient";
  return trimmed.toLowerCase().replace(
    /(^|[\s\-'/(])(\p{L})/gu,
    (_, before: string, letter: string) => before + letter.toUpperCase(),
  );
}

/** "Alex Tan" → "AT", "Madonna" → "MA", nothing → "?" */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1
    ? words[0].slice(0, 2)
    : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

const MEASUREMENT = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const COMPARATORS: Record<string, string> = {
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
};

/** A value in its unit, with any comparator: "47 U/L", "< 5 U/L", "≥ 90 mL/min/1.73m²". */
export function formatMeasurement(
  value: number,
  op: string | null,
  unit: string | null,
): string {
  const comparator = op ? `${COMPARATORS[op] ?? op} ` : "";
  return `${comparator}${MEASUREMENT.format(value)}${unit ? ` ${unit}` : ""}`;
}

/** plural(1, "report") → "1 report", plural(3, "report") → "3 reports" */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "2026-03-18T08:40:00" → "18 Mar 2026". Read from the text, so time zones can't shift it. */
export function dayMonthYear(iso: string | null): string | null {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const month = match && MONTHS[Number(match[2]) - 1];
  return match && month ? `${Number(match[3])} ${month} ${match[1]}` : null;
}

/** "2026-03-18T08:40:00" → "18 Mar 2026, 08:40"; just the date when no time is printed. */
export function dateAndTime(iso: string | null): string | null {
  const date = dayMonthYear(iso);
  const time = iso?.match(/T(\d{2}:\d{2})/)?.[1];
  return date && time ? `${date}, ${time}` : date;
}

/**
 * An instant (e.g. "2026-03-19T13:14:00.000Z") in local time, e.g.
 * "19 Mar 2026, 21:14". Formatting is left to the engine's Intl, so the exact
 * wording can vary slightly between browsers (", " or " at ").
 */
export function timestamp(
  iso: string | null,
  timeZone?: string,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/** Whole years from an ISO date of birth to `today` (local calendar date). */
export function ageOn(dateOfBirth: string | null, today: Date): number | null {
  const match = dateOfBirth?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) age--;
  return age >= 0 ? age : null;
}

/** "FEMALE" or "F" → "Female". */
export function displaySex(sex: string | null): string | null {
  const value = sex?.trim().toLowerCase();
  if (!value) return null;
  if (value === "f" || value === "female") return "Female";
  if (value === "m" || value === "male") return "Male";
  return displayName(value);
}

/** Only the last four characters of an ID number stay readable: "•••• 482K". */
export function maskId(id: string | null): string | null {
  const compact = id?.replace(/\s+/g, "");
  if (!compact) return null;
  return compact.length <= 4 ? compact : `•••• ${compact.slice(-4)}`;
}
