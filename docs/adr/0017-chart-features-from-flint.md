# 0017. New chart features come from Flint, not overlays

- **Status:** Accepted
- **Date:** 2026-09-15
- **Decided by:** Owner

## Context

Each chart library has a small overlay ([ADR 0010](0010-flint-chart-spec.md))
for what Flint can't express yet: reference bands, hollow markers for results
reported as bounds, and the shared axes. Any new chart idea, such as a lollipop
from the edge of the lab's range or a median line, could be built the same way,
with code in each of the four libraries. That's four copies to maintain for
every feature, and none of it improves as Flint and the libraries do.

Chart themes ([ADR 0016](0016-flint-chart-themes.md)) took the other route:
Flint's feature is passed through, and each library shows it once Flint supports
it there.

## Decision

- New chart types and options are **progressive enhancement**: offered through
  Flint as they are, in the libraries where Flint supports them. Elsewhere the
  app says the library can't show it yet and keeps what it has, as with themes.
- **No new overlay code** for a new feature. The overlays stay limited to what
  ADR 0010 lists, and shrink as Flint adds those things (see
  `docs/proposals/flint-reference-bands.md`).
- What a lab chart must show still applies to anything Flint offers: flagged
  results stand out, bounds aren't drawn as exact values, and change over time
  isn't distorted (no zero-based bars for results). A Flint feature that can't
  meet that isn't offered.
- An idea that needs overlay code is parked, or asked of Flint as a feature
  request, rather than built.

## Options considered

- **An overlay per idea:** anything is possible now, in all four libraries, but
  it's four implementations per feature, and none of them gets better with
  updates.
- **One chart library used directly, for richer charts:** brings back the
  rewrite problem ADR 0010 avoids.

## Consequences

- Some ideas wait on Flint: the "distance from range" lollipop and the median
  line are parked.
- Support is uneven across libraries: in flint-chart 0.5.1 the heatmap and the
  ranged dot plot exist for Vega-Lite, ECharts and Plotly, but not Chart.js.
- Updating Flint or a chart library can bring new chart features without app
  changes, the same way it brings new themes.
