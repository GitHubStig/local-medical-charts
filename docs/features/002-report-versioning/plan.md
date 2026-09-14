# 002. Report versioning and upgrades: plan

## Approach

Separate the three kinds of change
([ADR 0003](../../adr/0003-versioned-reports-originals-kept.md)): format changes
are migrations; catalog and merge changes are re-merges from the embedded pages;
prompt changes are recorded but need a new reading.

## Modules

| File                     | Role                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `src/version.ts`         | `SCHEMA_VERSION`, with no imports so the browser can check versions cheaply   |
| `src/schema.ts`          | `schemaVersion` on page files and reports; `pages` embedded in reports        |
| `src/migrations/mod.ts`  | Migration type, the ordered list, `migrate()`; how to add one after release   |
| `src/upgrade.ts`         | `upgradeReport(json, catalog)`: migrate, decide whether to re-merge, validate |
| `src/upgrade-reports.ts` | CLI over report files                                                         |
| `src/upgrade_test.ts`    | Current report unchanged, catalog change re-merges, future version refused    |

## Rules for a future migration (after release)

1. Bump `SCHEMA_VERSION` and change the Zod schemas.
2. Add `NNN-short-name.ts` exporting a pure migration from the previous version.
3. Register it, and test it on a small synthetic report in the old format.
4. A migration only brings `schemaVersion`, `source.report` and `pages` up to
   date; everything derived is rebuilt by the re-merge.
