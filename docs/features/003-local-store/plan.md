# 003. Local store: plan

## Approach

`node:sqlite` on the Deno side ([ADR 0007](../../adr/0007-sqlite-storage.md)),
synchronous, with every multi-step write in a transaction. The store never
depends on the page; the bindings (feature 004) sit on top.

## Modules

| File                             | Role                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `desktop/store/store.ts`         | `ReportStore`: add, upgrade all, list patients and reports, results, delete, settings |
| `desktop/store/db-migrations.ts` | Migration 1 (tables), `PRAGMA user_version`, expected-tables check                    |
| `desktop/store/paths.ts`         | App-data folder per OS; `MEDICAL_CHARTS_DATA_DIR` override                            |
| `desktop/upload-checks.ts`       | Wrong-file explanations and identity warnings, shared with the browser fake           |
| `desktop/report-data.ts`         | Patient identity key, result rows from a report, report without pages                 |
| `desktop/settings.ts`            | Settings, defaults, validation of patches from the page                               |
| `desktop/store/testing.ts`       | Synthetic reports and catalogs for tests                                              |

## Tables

`patients` (identity key, latest name, ID, date of birth, sex), `reports`
(content hash, file name, original JSON, upgraded JSON, versions, catalog hash,
status), `results` (one row per result with standard values and ranges),
`settings` (key, JSON value).

## Testing

`store_test.ts` and `db-migrations_test.ts` on in-memory databases; the contract
suite (feature 004) repeats the observable behaviour against the fake.
