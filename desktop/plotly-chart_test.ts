import { assert, assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { plotlyFigure } from "../app/src/lib/charts/plotly-spec.ts";
import { buildSeries, dateMs, type Series } from "../app/src/lib/series.ts";

// Uses the fictional sample reports (samples/). Plotly needs a browser to draw,
// so these check the figure rather than the rendered chart.

const PALETTE = {
  series: "#2a78d6",
  band: "#eceae4",
  bandEdge: "#d3cfc6",
  critical: "#d03b3b",
  surface: "#ffffff",
  muted: "#77706b",
  grid: "#eeece7",
  axis: "#d6d2ca",
  font: "IBM Plex Sans, sans-serif",
};
/** The zoomed view's chart, with axes. */
const LARGE = { width: 1088, height: 320 };
const SIZE = { width: 294, height: 64 };

async function alexSeries(key: string): Promise<Series> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const alex = (await b.listPatients()).find((p) => p.name === "ALEX TAN")!;
  return buildSeries((await b.getDashboard(alex.id))!).get(key)!;
}

// deno-lint-ignore no-explicit-any
type Loose = any;

Deno.test("Flint's Plotly line gets the bands as shapes and markers on top, on the series' window", async () => {
  const alt = await alexSeries("alt");
  const figure = plotlyFigure(alt, PALETTE, SIZE) as Loose;
  assert(
    Object.keys(figure).every((key) => !key.startsWith("_")),
    "Flint's own keys are left behind",
  );

  const { xaxis, yaxis, shapes } = figure.layout;
  assertEquals(
    [xaxis.type, xaxis.visible, xaxis.range],
    ["linear", false, alt.domain!.x.map(dateMs)],
  );
  assertEquals([yaxis.visible, yaxis.range], [false, alt.domain!.y]);
  assertEquals(figure.config.displayModeBar, false);

  // Northside's 0 – 40, then Harbour's < 35 open down to the bottom of the window.
  const rects = shapes.filter((s: Loose) => s.type === "rect");
  assertEquals(
    rects.map((s: Loose) => [s.y0, s.y1, s.fillcolor, s.layer]),
    [
      [0, 40, PALETTE.band, "below"],
      [alt.domain!.y[0], 35, PALETTE.band, "below"],
    ],
  );
  // Only real limits get an edge line: 0 and 40, then 35.
  assertEquals(
    shapes.filter((s: Loose) => s.type === "line").map((s: Loose) => s.y0),
    [0, 40, 35],
  );

  const [line, filled, hollow] = figure.data;
  assertEquals(figure.data.length, 3);
  assertEquals(
    [line.mode, line.line.color, line.hoverinfo],
    ["lines", PALETTE.series, "skip"],
  );
  // "<7" is the hollow marker; March's 48 is flagged high.
  assertEquals([hollow.y, hollow.marker.color], [[7], PALETTE.surface]);
  assertEquals(filled.marker.color.at(-1), PALETTE.critical);
  assertEquals(
    filled.customdata.at(-1),
    "18 Mar 2026 · 48 U/L · Harbour Medical Lab · High",
  );
});

Deno.test("every sample chart builds a Plotly figure with every reading", async () => {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  for (const patient of await b.listPatients()) {
    for (const s of buildSeries((await b.getDashboard(patient.id))!).values()) {
      const figure = plotlyFigure(s, PALETTE, SIZE) as Loose;
      const plotted = figure.data.slice(1)
        .reduce((n: number, trace: Loose) => n + trace.x.length, 0);
      assertEquals(plotted, s.points.length, s.key);
    }
  }
});

Deno.test("the large chart gets value and date axes, and names the latest range", async () => {
  const alt = await alexSeries("alt");
  const { layout } = plotlyFigure(alt, PALETTE, LARGE, true) as Loose;
  assertEquals(layout.margin, { t: 12, r: 72, b: 44, l: 48, pad: 0 });
  assertEquals(
    [layout.yaxis.visible, layout.yaxis.range, layout.yaxis.tickvals],
    [true, [0, 60], [0, 20, 40, 60]],
  );
  assertEquals(layout.xaxis.tickvals.length, 4);
  assertEquals(layout.xaxis.ticktext[0], "12 Nov 2024<br>Northside Pathology");
  // Plotly reads label text as HTML, so "<" is escaped.
  assertEquals(
    layout.annotations.map((a: Loose) => [a.text, a.y, a.yref, a.xref]),
    [["&lt; 35", 17.5, "y", "paper"]],
  );

  const card = plotlyFigure(alt, PALETTE, SIZE) as Loose;
  assertEquals(
    [card.layout.xaxis.visible, card.layout.annotations],
    [false, []],
  );
});
