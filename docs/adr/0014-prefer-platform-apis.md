# 0014. Prefer platform APIs

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

Timestamps formatted with `Intl.DateTimeFormat` differ slightly between Chromium
and WebKit (", " versus " at "). Identical output would mean formatting by hand
with `formatToParts`. The result is readable either way, and more code to force
identical strings isn't worth it.

## Decision

- Use the platform: `Intl.DateTimeFormat`, `Intl.DurationFormat`,
  `Intl.Collator` (numeric file-name order), native `<dialog>`, Web Streams,
  `URL`.
- Report cross-engine differences, but only work around one that breaks meaning
  or layout.
- Tests of engine-dependent strings say which engine they assume.

## Consequences

- Less code, and formatting that improves as browsers do.
- Small cosmetic differences between the browser and the desktop webview.
- Occasionally a type declaration is needed where TypeScript lags the platform
  (`Intl.DurationFormat`).
