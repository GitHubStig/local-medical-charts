import { assert, assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import {
  bandGeometry,
  chartjsConfig,
} from "../app/src/lib/charts/chartjs-spec.ts";
import { buildSeries, dateMs, type Series } from "../app/src/lib/series.ts";

// Uses the fictional sample reports (samples/). Chart.js needs a canvas to draw,
// so these check the config and the band plugin's geometry rather than pixels.

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

Deno.test("Flint's Chart.js line sits under the markers, on the series' window", async () => {
  const alt = await alexSeries("alt");
  const config = chartjsConfig(alt, PALETTE, SIZE) as Loose;
  assert(
    Object.keys(config).every((key) => !key.startsWith("_")),
    "Flint's own keys are left behind",
  );

  const { x, y } = config.options.scales;
  assertEquals(
    [x.type, x.display, x.min, x.max],
    ["linear", false, ...alt.domain!.x.map(dateMs)],
  );
  assertEquals([y.display, y.min, y.max], [false, ...alt.domain!.y]);
  assertEquals(config.options.plugins.tooltip.enabled, false);

  const [line, filled, hollow] = config.data.datasets;
  assertEquals(config.data.datasets.length, 3);
  assertEquals([line.borderColor, line.pointRadius], [PALETTE.series, 0]);
  assert(line.order > filled.order, "the line draws under the markers");

  // "<7" is the hollow marker; March's 48 is flagged high.
  assertEquals(hollow.data.map((p: Loose) => p.y), [7]);
  assertEquals(hollow.pointBackgroundColor, PALETTE.surface);
  assertEquals(filled.pointBackgroundColor.at(-1), PALETTE.critical);
  assertEquals(
    filled.data.at(-1).tooltip,
    "18 Mar 2026 · 48 U/L · Harbour Medical Lab · High",
  );
  assertEquals(config.plugins.map((p: Loose) => p.id), ["referenceBands"]);
});

Deno.test("bands and their edges are placed in pixels and kept inside the plot", () => {
  // x: 1px per unit from 0; y: 50px tall, value 0 at the bottom.
  const x = { getPixelForValue: (v: number) => v };
  const y = { getPixelForValue: (v: number) => 50 - v };
  const area = { left: 0, right: 100, top: 0, bottom: 50 };
  const { rects, lines } = bandGeometry(
    [
      { start: 0, end: 50, low: 0, high: 40 },
      // Runs past the right edge and below the bottom: clipped to the plot.
      { start: 50, end: 200, low: -10, high: 35 },
    ],
    [{ start: 0, end: 50, value: 40 }],
    x,
    y,
    area,
  );
  assertEquals(rects, [
    { x: 0, y: 10, width: 50, height: 40 },
    { x: 50, y: 15, width: 50, height: 35 },
  ]);
  assertEquals(lines, [{ x1: 0, x2: 50, y: 10 }]);
});

Deno.test("every sample chart builds a Chart.js config", async () => {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  for (const patient of await b.listPatients()) {
    for (const s of buildSeries((await b.getDashboard(patient.id))!).values()) {
      const config = chartjsConfig(s, PALETTE, SIZE) as Loose;
      const plotted = config.data.datasets.slice(1)
        .reduce((n: number, d: Loose) => n + d.data.length, 0);
      assertEquals(plotted, s.points.length, s.key);
    }
  }
});

Deno.test("the large chart gets value and date axes, and names the latest range", async () => {
  const alt = await alexSeries("alt");
  const config = chartjsConfig(alt, PALETTE, LARGE, true) as Loose;
  const { x, y } = config.options.scales;
  assertEquals([y.display, y.min, y.max, y.ticks.stepSize], [true, 0, 60, 20]);
  assertEquals(y.ticks.callback(40), "40");

  const scale = { ticks: [] as Loose[] };
  x.afterBuildTicks(scale);
  assertEquals(scale.ticks.length, 4);
  assertEquals(x.ticks.callback(scale.ticks[0].value), [
    "12 Nov 2024",
    "Northside Pathology",
  ]);

  // The plugin writes the range just past the plot's right edge, level with its band.
  const written: unknown[] = [];
  const ctx = {
    save() {},
    restore() {},
    fillText: (...args: unknown[]) => written.push(args),
  };
  config.plugins[0].afterDraw({
    ctx,
    chartArea: { right: 968 },
    scales: { y: { getPixelForValue: (v: number) => 300 - v } },
  });
  assertEquals(written, [["< 35", 976, 282.5]]);

  // Cards stay bare.
  const card = chartjsConfig(alt, PALETTE, SIZE) as Loose;
  assertEquals(
    [card.options.scales.x.display, card.options.scales.y.display],
    [false, false],
  );
});
