# 005. Dashboard: plan

## Approach

Screens are thin; logic lives in plain, tested functions in `app/src/lib/`. One
shared composable (`useLibrary`) holds connection, patients, selection and the
last import.

## Modules

| File                                                 | Role                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `app/src/composables/useLibrary.ts`                  | Connect, load patients, select, import JSON, delete, clear                                                                       |
| `app/src/lib/import-files.ts`                        | Read picked files, answer wrong files locally, summarise outcomes                                                                |
| `app/src/lib/selection.ts`                           | Which patient to show after loading or importing                                                                                 |
| `app/src/lib/dashboard.ts`                           | Patient overview, report rows and details                                                                                        |
| `app/src/lib/test-grid.ts`, `text-results.ts`        | Grid groups, cards, search, flagged filter; word results                                                                         |
| `app/src/views/WelcomeView.vue`, `DashboardView.vue` | The two screens                                                                                                                  |
| `app/src/components/`                                | TopBar, PatientPicker, PatientSummary, ReportsSection, ReportItem, TestGrid, TestCard, TextResults, SingleReportNotice, FlagPill |

Tests for the `lib/` functions live in `desktop/*_test.ts`.
