# Chart interactivity from Flint

- **Status:** Waiting on Flint; checked against flint-chart 1.0.0.

Flint 1.0 adds interactions: click and hover highlight, brushing, zoom and pan,
annotations, and linked charts. Under
[ADR 0017](../adr/0017-chart-features-from-flint.md) the app would take them as
they come, in the libraries Flint supports. Today they can't be used without
losing what a lab chart must show.

- **Flint renders the chart itself.** Interactions come through `mountChart`
  (`flint-chart/interactive`), which takes the chart input, assembles it and
  draws it. There's no step between assembling and drawing where the overlays in
  `app/src/lib/charts/` could add the reference bands, the hollow markers for
  bounds and the shared axes. The Vega-Lite renderer it uses isn't exported, so
  it can't be attached to the view the app draws either.
- **Vega-Lite only.** ECharts, Chart.js and Plotly draw the chart static and
  report an `interactions_ignored` warning.
- **What would unblock it:** a hook in `mountChart` to change the assembled spec
  before it's drawn, so the overlays come along as they are. Reference bands in
  Flint ([the bands feature request](flint-reference-bands.md)) aren't enough on
  their own: the hollow markers and the shared axes are overlays too.
- **Worth having once it works:** hover highlight on a reading and zoom on the
  large chart, once years of results crowd the axis. Not brushing or linked
  charts: one test per chart doesn't need them.
