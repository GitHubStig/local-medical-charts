# 011. Chart themes: plan

## Approach

A theme goes to Flint in its own input (`theme_spec`). Whether a library
supports it is found by assembling a small fixed chart with and without the
theme. Where a theme applies, the library's overlay keeps Flint's styling and
adds only the app's rules ([ADR 0016](../../adr/0016-flint-chart-themes.md)).

## Modules

| File                                                                             | Role                                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `app/src/lib/charts/themes.ts`                                                   | Theme list from Flint, support detection, the overlay's colours for a theme |
| `app/src/lib/charts/vega-lite-spec.ts`, `plotly-spec.ts`                         | Themed branch: Flint's styling kept, the app's rules added                  |
| `app/src/lib/charts/echarts-spec.ts`, `chartjs-spec.ts`                          | The theme passed to Flint once Flint supports it; App look until then       |
| `desktop/settings.ts`                                                            | `chartTheme` setting: "app" or a theme id                                   |
| `app/src/composables/useChartSettings.ts`, `app/src/components/ChartOptions.vue` | The saved choice; the dropdown, loaded with the chart library               |
| `desktop/chart-themes_test.ts`                                                   | Support per library and theme; themed charts keep the app's rules           |

## Order

The overlays give way first, with App unchanged. Then the setting and dropdown,
then each theme checked in cards and the large view, then these docs and the
updating steps in `docs/development.md`.
