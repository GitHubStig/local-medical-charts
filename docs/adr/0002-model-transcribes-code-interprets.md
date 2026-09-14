# 0002. The model transcribes, code interprets

- **Status:** Accepted
- **Date:** 2026-09-12
- **Decided by:** Owner and assistant together

## Context

Reports from two labs for the same person already disagree on test names, units
and how reference ranges are printed. Should the AI prompt or code combine tests
with similar names? The owner's worry is that code would be brittle across so
many formats. Letting a model decide what's "the same test" is flexible but
unpredictable, and a wrong merge silently puts two different measurements on one
chart.

## Decision

- The model's only job is **transcription**: values, units and ranges copied
  verbatim as strings, into a flat page schema.
- **Code interprets** deterministically (`src/normalize.ts`): parses values and
  ranges, derives flags, converts units.
- **An analyte catalog** (`src/analytes.json`) decides which printed names are
  the same measurement, by exact lookup on name, specimen and unit. Never fuzzy.
- Unknown names stay "not in the catalog". `deno task map` asks the model for
  suggestions; a person accepts them, and conversion factors are only typed in
  by a person.
- Reference ranges are kept as printed and parsed per report, so each lab's
  range goes with its own result.

## Options considered

- **Ask the model to normalise names and units:** simplest, but untestable and
  nondeterministic; a model update could silently change which tests merge.
- **Fuzzy matching in code:** brittle in exactly the way the owner feared, and
  still guesses.

## Consequences

- The same report always merges the same way; merges are unit-tested.
- New lab layouts mean catalog entries, not code changes.
- Some tests show as "not in the catalog" until someone adds them.
- Re-merging a stored report with a newer catalog needs no model
  ([ADR 0003](0003-versioned-reports-originals-kept.md)).
