# 0016. Flint's chart themes, with the app's rules kept

- **Status:** Accepted
- **Date:** 2026-09-15
- **Decided by:** Owner

## Context

Flint ships visual themes (The Economist, Nature, Swiss and others) and applies
them when it assembles a chart, but not yet for every library: in flint-chart
0.5.1, Vega-Lite and Plotly are themed and ECharts and Chart.js aren't. Each
library's overlay ([ADR 0010](0010-flint-chart-spec.md)) restyles Flint's output
to the app's colours, which would paint over a theme. And parts of a lab chart
carry meaning that a theme mustn't change.

## Decision

- A **chart theme** setting: "App" (the app's own look, and the default) or any
  theme Flint ships. The list comes from Flint, so new themes appear when Flint
  is updated.
- Support is **detected, not listed**: a library shows a theme when Flint's
  output for that library changes with it. Otherwise its charts keep the App
  look, and the dropdown says the library can't show the theme yet.
- Where a theme applies, the overlay **gives way**: Flint's background, font,
  line colour and weight, and axis styling stay. The overlay's own colours
  (reference bands, marker rings, the range label) come from the theme.
- Whatever the theme, **the app keeps** flagged results in its warning colour
  (and never marked by colour alone), hollow markers for bounds, visible
  reference bands, and every tick and label on the shared axes.
- Themes apply to the cards and the large view.

## Options considered

- **The app's own chart looks** (Minimal, Bold, High contrast) in all four
  libraries: consistent everywhere, but hand-made, and they never grow with
  Flint.
- **Flint's themes copied into the app's palette for every library:** themed
  everywhere at once, but a copy of Flint's work that drifts as Flint changes.

## Consequences

- Updating Flint or a chart library can add themes, or support for them, without
  code changes. `desktop/chart-themes_test.ts` reports which libraries each
  theme applies to, and fails when that changes.
- When Flint starts theming ECharts or Chart.js, that library's overlay needs
  the same give-way branch before the theme fully shows (see
  [Chart themes](../development.md#chart-themes)).
- Most themes are light, so in dark mode a themed chart is a light panel.
- Theme ids are only checked for their shape; a theme Flint drops shows as App.
