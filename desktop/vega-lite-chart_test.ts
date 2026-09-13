import { assert, assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { chartRows } from "../app/src/lib/charts/flint-input.ts";
import {
  compileVegaLite,
  vegaLiteSpec,
  vegaLiteSvg,
} from "../app/src/lib/charts/vega-lite-spec.ts";
import { buildSeries, dateMs, type Series } from "../app/src/lib/series.ts";

// Uses the fictional sample reports (samples/).

const PALETTE = {
  series: "#2a78d6",
  band: "#eceae4",
  bandEdge: "#d3cfc6",
  critical: "#d03b3b",
  surface: "#ffffff",
};
const SIZE = { width: 282, height: 52 };

async function alexSeries(key: string): Promise<Series> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const alex = (await b.listPatients()).find((p) => p.name === "ALEX TAN")!;
  return buildSeries((await b.getDashboard(alex.id))!).get(key)!;
}

// deno-lint-ignore no-explicit-any
type Layer = any;
const layers = (spec: unknown): Layer[] => (spec as { layer: Layer[] }).layer;

Deno.test("chart rows carry exact times, bounds, flags and hover text", async () => {
  const alt = await alexSeries("alt");
  const rows = chartRows(alt);
  assertEquals(rows[0], {
    date: Date.UTC(2024, 10, 12, 8, 40),
    value: 5,
    bound: true,
    flagged: false,
    tooltip: "12 Nov 2024 · < 5 U/L · Northside Pathology",
  });
  assertEquals(
    rows[3].tooltip,
    "18 Mar 2026 · 47 U/L · Harbour Medical Lab · High",
  );
});

Deno.test("Flint's line sits between the reference bands and the markers, on the series' window", async () => {
  const alt = await alexSeries("alt");
  const spec = vegaLiteSpec(alt, PALETTE, SIZE) as unknown as Record<
    string,
    unknown
  >;
  assert(
    Object.keys(spec).every((key) => !key.startsWith("_")),
    "Flint's own keys are stripped",
  );

  const [bands, edges, line, filled, hollow, targets] = layers(spec);
  assertEquals(layers(spec).length, 6);
  assertEquals(line.mark.type, "line");
  assertEquals(line.mark.color, PALETTE.series);
  // The window is set once, on the line; the other layers share its scales.
  assertEquals(
    [bands, edges, filled, hollow, targets].map((l) => l.encoding.x.scale),
    [undefined, undefined, undefined, undefined, undefined],
  );
  assertEquals(line.encoding.x.scale, {
    type: "utc",
    domain: alt.domain!.x.map(dateMs),
  });
  assertEquals(line.encoding.y.scale.domain, alt.domain!.y);

  // Northside's 0 – 40, then Harbour's < 35 open down to the bottom of the window.
  assertEquals(
    bands.data.values.map((b: Layer) => [b.low, b.high]),
    [[0, 40], [alt.domain!.y[0], 35]],
  );
  assertEquals(bands.mark.color, PALETTE.band);
  // Only real limits get an edge line: 0 and 40, then 35.
  assertEquals(edges.data.values.map((e: Layer) => e.value), [0, 40, 35]);

  assertEquals([filled.mark.filled, hollow.mark.filled], [true, false]);
  assertEquals(filled.encoding.fill.condition.value, PALETTE.critical);
  assertEquals(targets.encoding.tooltip, { field: "tooltip" });
});

Deno.test("every sample chart compiles without Vega-Lite warnings", async () => {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  for (const patient of await b.listPatients()) {
    const series = buildSeries((await b.getDashboard(patient.id))!);
    for (const s of series.values()) {
      const { warnings } = compileVegaLite(vegaLiteSpec(s, PALETTE, SIZE));
      assertEquals(warnings, [], s.key);
    }
  }
});

Deno.test("the spec renders with Vega: bands, line and every marker", async () => {
  const hb = await alexSeries("haemoglobin");
  const svg = await vegaLiteSvg(vegaLiteSpec(hb, PALETTE, SIZE));
  const fills = (colour: string) => svg.split(`fill="${colour}"`).length - 1;
  assertEquals(fills(PALETTE.band), 2, "one band per lab range");
  assert(svg.includes(`stroke="${PALETTE.series}"`), "the line is drawn");
  // October 2025 was low: its marker is the critical colour.
  assertEquals(fills(PALETTE.critical), 1);
  assertEquals(fills(PALETTE.series), 3);
});
