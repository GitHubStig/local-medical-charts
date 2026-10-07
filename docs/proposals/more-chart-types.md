# More chart types

- **Status:** Proposed, not built.

Let the four chart libraries show more than line charts. New chart types arrive
through Flint, not overlay code
([ADR 0017](../adr/0017-chart-features-from-flint.md)).

In order of value:

1. **A ranged dot plot** of each latest result within its range, leaving out
   one-sided ranges and word results. Flint 0.5.1 has it for Vega-Lite, ECharts
   and Plotly, but not Chart.js.
2. **A stacked bar** of the white cell breakdown per report. Flint 0.5.1 has it
   for all four libraries. The samples would need the other four cell types.

Not needed: a heatmap of every test against every report, since the Tests table
shows the same. Avoid radar, rose, pie and dual-axis charts.
