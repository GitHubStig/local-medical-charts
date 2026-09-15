# Flint feature request: reference bands

A draft issue for
[microsoft/flint-chart](https://github.com/microsoft/flint-chart/issues), not
yet posted. If Flint adds this, the band part of each chart library's overlay in
`app/src/lib/charts/` can go ([ADR 0010](../adr/0010-flint-chart-spec.md)).

Before posting:

- Post it from the owner's GitHub account.
- Once this repo is public, link to `app/src/lib/charts/` as a working example
  of the overlays.
- Check the example data renders as expected in Flint's playground.

---

**Title:** Reference bands under a Line Chart, on every backend

**What I'm building**

A local app that charts lab results over time. Every chart is a Flint
`Line Chart`, compiled for Vega-Lite, ECharts, Chart.js and Plotly (switchable
at runtime), using flint-chart 0.5.1. Behind each line, the chart shades the
lab's reference range, so a reading outside it stands out.

**What I can't express in Flint today**

A shaded y range between two x values, drawn under the line. The range can
change from one reading to the next (for example, a different lab), so one chart
needs several bands side by side. A band can also be open on one side: a range
printed as `< 5.2` has only an upper limit.

I looked for existing ways to do this: the `Range Area Chart` template draws a
y/y2 area, but as its own chart type rather than under a line, and the
sparkline's "Reference line" is a fixed average, zero or median baseline.

**Current workaround**

After `assemble*`, each backend gets its own overlay for the bands: extra layers
in Vega-Lite, `markArea` and `markLine` in ECharts, layout `shapes` in Plotly,
and a plugin in Chart.js. They work, but they're four implementations of one
idea, and each needs to know its library's scales and layout, which is what
Flint otherwise hides.

**A possible shape (just a sketch)**

```ts
chart_spec: {
  chartType: "Line Chart",
  encodings: {
    x: { field: "date", type: "temporal" },
    y: { field: "value", type: "quantitative" },
  },
  referenceBands: [
    { x: [Date.UTC(2024, 10, 1), Date.UTC(2025, 6, 1)], y: [11.5, 16] },
    { x: [Date.UTC(2025, 6, 1), Date.UTC(2026, 3, 1)], y: [12, 15.5] },
    // `null` for an open limit, e.g. y: [null, 5.2], running to the axis edge
  ],
}
```

Or data-driven: a second table with `x`, `x2`, `y` and `y2` fields.

**Example data (made up)**

| Date        | Value (g/dL) | Lab range |
| ----------- | ------------ | --------- |
| 12 Nov 2024 | 12.5         | 11.5–16   |
| 20 May 2025 | 12.2         | 11.5–16   |
| 3 Oct 2025  | 11.7         | 12–15.5   |
| 18 Mar 2026 | 12.5         | 12–15.5   |

I'm happy to try a build against all four backends.
