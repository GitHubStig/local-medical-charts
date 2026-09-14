# 0010. Flint as the chart spec, four renderers

- **Status:** Accepted
- **Date:** 2026-09-13
- **Decided by:** Owner

## Context

Charts are the heart of the app. Tying it to one charting library means that
replacing the library later is a rewrite of every chart component. The owner has
done that rewrite before (moving a product's charts from a deprecated library to
Highcharts) and wanted to avoid it here.

Microsoft's [Flint](https://microsoft.github.io/flint-chart/) is an intermediate
chart language: one spec compiles to Vega-Lite, ECharts, Chart.js or Plotly
configs. It's pre-1.0 (0.5.1), and it can't draw reference bands or layer a
range area under a line, which the app needs for lab ranges.

## Decision

- Charts are defined once from app data (`lib/series.ts`), turned into one Flint
  input, and assembled for the chosen library.
- A small **overlay per library** adds what Flint can't express yet: reference
  bands, hollow markers for results like `< 5`, and shared axes. Each overlay is
  meant to shrink or disappear as Flint adds features.
- All four libraries are supported and **switchable at runtime**; each loads as
  its own chunk only when chosen.
- Build one library at a time, Vega-Lite first.

## Options considered

- **One library directly (e.g. ECharts):** less code, but the rewrite problem
  returns.
- **A hand-written adapter layer:** exactly what Flint already is.

## Consequences

- Swapping libraries is a setting, not a rewrite; the app doubles as a Flint
  showcase.
- Four overlays to maintain, and four libraries in the dependency list (each
  pinned and lazy-loaded).
- Chart specs are built without a DOM, so they're unit-tested in Deno.
