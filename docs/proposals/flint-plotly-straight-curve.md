# Flint bug report: a theme overrides a straight Plotly line

- **Status:** Posted 2026-10-21 as
  [microsoft/flint-chart#149](https://github.com/microsoft/flint-chart/issues/149).

The issue as posted to
[microsoft/flint-chart](https://github.com/microsoft/flint-chart/issues).
Nothing like it was reported as of 2026-10-21 (issues, pull requests and
discussions searched). In the app, it shows as the Straight curve drawing a
spline under the Cartoon theme and steps under De Stijl, in Plotly only.

Once Flint fixes it, update flint-chart and check Straight under Cartoon and De
Stijl in Plotly.

---

**Title:** Plotly: a theme's line interpolation overrides an explicit
`interpolate: "linear"`

**What happens**

With a theme that sets its own line interpolation (Cartoon: `monotone`, De
Stijl: `step`), a Line Chart whose `chartProperties` ask for
`interpolate: "linear"` is drawn curved or stepped on Plotly. Other curves are
kept, and Vega-Lite keeps all three.

| Theme    | `interpolate` | Plotly `line.shape` | Vega-Lite mark `interpolate` |
| -------- | ------------- | ------------------- | ---------------------------- |
| (none)   | `linear`      | `linear`            | `linear`                     |
| cartoon  | `linear`      | `spline`            | `linear`                     |
| cartoon  | `monotone`    | `spline`            | `monotone`                   |
| cartoon  | `step-after`  | `hv`                | `step-after`                 |
| de-stijl | `linear`      | `hv`                | `linear`                     |
| de-stijl | `monotone`    | `spline`            | `monotone`                   |
| de-stijl | `step-after`  | `hv`                | `step-after`                 |

**Reproduction** (flint-chart 1.0.0)

```ts
import { assemblePlotly } from "flint-chart/plotly";

const input = {
  data: {
    values: [
      { date: "2025-01-01", value: 4 },
      { date: "2025-06-01", value: 6 },
      { date: "2026-01-01", value: 5 },
    ],
  },
  semantic_types: { date: "DateTime", value: "Quantity" },
  chart_spec: {
    chartType: "Line Chart",
    encodings: {
      x: { field: "date", type: "temporal" },
      y: { field: "value", type: "quantitative" },
    },
    chartProperties: { interpolate: "linear" },
  },
  theme_spec: "cartoon",
};

console.log(assemblePlotly(input).data[0].line.shape); // "spline", expected "linear"
```

**Likely cause**

In `packages/flint-js/src/plotly/theme.ts`, the theme fills in the line shape
when it's unset _or_ `'linear'`:

```ts
if (m.interpolate && !trace._preserveLineShape
    && (!trace.line.shape || trace.line.shape === 'linear')) {
```

The Line Chart template always sets `line.shape` (`'linear'` when no curve is
asked for), so the theme can't tell an explicit `linear` from no choice.
Connected Scatter avoids this with `_preserveLineShape`. Perhaps the Line Chart
template could set that flag when `chartProperties.interpolate` is given, or
leave `line.shape` unset when it isn't.

**Why it matters to me**

I let people pick a curve (straight, smooth, steps) for lab results over time,
and a theme on top of that. Straight matters there: it doesn't suggest values
between readings that were never measured.
