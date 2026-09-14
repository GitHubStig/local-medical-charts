# 006. Charts: plan

## Approach

App data becomes a library-independent `Series`; Flint turns that into each
library's config; a small overlay per library adds bands, bound markers and axes
([ADR 0010](../../adr/0010-flint-chart-spec.md)). Spec builders have no DOM, so
Deno tests build and check them.

## Modules

| File                                                                           | Role                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `app/src/lib/series.ts`                                                        | Series per analyte: points, units, range bands and edges            |
| `app/src/lib/charts/flint-input.ts`                                            | One Flint line chart plus overlay data                              |
| `app/src/lib/charts/*-spec.ts`                                                 | Vega-Lite, ECharts, Chart.js and Plotly configs with their overlays |
| `app/src/lib/charts/{vega-lite,echarts,chartjs,plotly}.ts`                     | Lazy-loaded renderers                                               |
| `app/src/lib/charts/axes.ts`, `palette.ts`                                     | Shared axis ticks; colours resolved from CSS tokens                 |
| `app/src/components/TestChart.vue`, `TestDetail.vue`, `ChartLibraryToggle.vue` | Card chart, large view (native `<dialog>`), switcher                |
| `app/src/composables/useChartLibrary.ts`                                       | Chosen library, stored in settings                                  |

## Order

Series first, then one library at a time: Vega-Lite, ECharts, Chart.js, Plotly,
each with its own spec tests. Then the large view, then axes.
