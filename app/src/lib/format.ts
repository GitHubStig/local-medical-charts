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

/** plural(1, "report") → "1 report", plural(3, "report") → "3 reports" */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
