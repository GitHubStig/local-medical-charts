# 0019. Re-merge saved reports on every launch

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decided by:** Owner

## Context

[ADR 0003](0003-versioned-reports-originals-kept.md) says a change to the
catalog or the merge reaches saved reports by re-merging them from their page
readings. But its decision only upgrades a report on launch when its format
version or catalog hash is out of date. Nothing records which merge rules
(`src/normalize.ts`, `src/units.ts`) a report was built with, so fixing how a
date, number or flag is read never reached reports already saved: they kept the
old reading until they were deleted and imported again. `deno task upgrade` had
the same gap and needed `--force`.

## Decision

- **On every launch, every saved report is re-merged** from its original upload,
  as upgrades already are. It's written back only when the result differs from
  the stored report, ignoring when each was merged; an unchanged report isn't
  touched.
- `upgradeReport` does the same check for a report that is otherwise current: it
  re-merges, and reports `"merge changed"` when the result differs. So
  `deno task upgrade` catches merge changes without `--force`.
- The rest of ADR 0003 stands.

## Options considered

- **A merge version number,** raised by hand whenever the rules change and
  stored per report: cheaper at launch, but easy to forget, and it adds a
  column.
- **A hash of the merge code:** automatic, but it changes on any edit, even a
  comment, and a packaged app would have to bundle the source to hash it.

## Consequences

- Fixes to the merge reach every saved report on the next launch, with no step
  to remember.
- Launch does a merge per report. A merge calls no model and takes about a
  millisecond, so a few hundred reports add well under a second.
- A merge change that makes a saved report fail marks it failed on the next
  launch, as a bad catalog change would; it's kept and retried, never deleted.
