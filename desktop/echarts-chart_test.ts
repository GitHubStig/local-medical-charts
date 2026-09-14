import { assert, assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import {
  echartsOption,
  echartsSvg,
  HOVER_TARGETS,
} from "../app/src/lib/charts/echarts-spec.ts";
import { buildSeries, dateMs, type Series } from "../app/src/lib/series.ts";

// Uses the fictional sample reports (samples/).

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

Deno.test("Flint's ECharts line carries the reference bands, with markers on top, on the series' window", async () => {
  const alt = await alexSeries("alt");
  const option = echartsOption(alt, PALETTE, SIZE) as Loose;
  assert(
    Object.keys(option).every((key) => !key.startsWith("_")),
    "Flint's own keys are stripped",
  );

  assertEquals(
    [option.xAxis.type, option.xAxis.show, option.xAxis.min, option.xAxis.max],
    ["time", false, ...alt.domain!.x.map(dateMs)],
  );
  assertEquals([option.yAxis.min, option.yAxis.max], alt.domain!.y);

  const [line, filled, hollow, targets] = option.series;
  assertEquals(option.series.length, 4);
  assertEquals([line.type, line.lineStyle.color], ["line", PALETTE.series]);

  // Northside's 0 – 40, then Harbour's < 35 open down to the bottom of the window.
  assertEquals(
    line.markArea.data.map(([from, to]: Loose) => [from.yAxis, to.yAxis]),
    [[0, 40], [alt.domain!.y[0], 35]],
  );
  // Only real limits get an edge line: 0 and 40, then 35.
  assertEquals(
    line.markLine.data.map(([from]: Loose) => from.coord[1]),
    [0, 40, 35],
  );

  // "<5" is the hollow marker; March's 47 is flagged high.
  assertEquals(hollow.data.map((d: Loose) => d.value[1]), [5]);
  assertEquals(filled.data.at(-1).itemStyle.color, PALETTE.critical);
  assertEquals(targets.id, HOVER_TARGETS);
  assertEquals(
    targets.data.at(-1).tooltip,
    "18 Mar 2026 · 47 U/L · Harbour Medical Lab · High",
  );
});

Deno.test("every sample chart builds an ECharts option", async () => {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  for (const patient of await b.listPatients()) {
    const series = buildSeries((await b.getDashboard(patient.id))!);
    for (const s of series.values()) {
      const svg = echartsSvg(s, PALETTE, SIZE);
      assert(svg.startsWith("<svg"), s.key);
    }
  }
});

Deno.test("the option renders with ECharts: bands, line and every marker", async () => {
  const hb = await alexSeries("haemoglobin");
  const svg = echartsSvg(hb, PALETTE, SIZE);
  const count = (attribute: string) => svg.split(attribute).length - 1;
  assertEquals(count(`fill="${PALETTE.band}"`), 2, "one band per lab range");
  assert(svg.includes(`stroke="${PALETTE.series}"`), "the line is drawn");
  // October 2025 was low: its marker is the critical colour.
  assertEquals(count(`fill="${PALETTE.critical}"`), 1);
  assertEquals(count(`fill="${PALETTE.series}"`), 3);
});

Deno.test("the large chart gets value and date axes, and names the latest range", async () => {
  const alt = await alexSeries("alt");
  const option = echartsOption(alt, PALETTE, LARGE, true) as Loose;
  assertEquals(
    [
      option.yAxis.show,
      option.yAxis.min,
      option.yAxis.max,
      option.yAxis.interval,
    ],
    [true, 0, 60, 20],
  );
  const [first] = option.xAxis.axisLabel.customValues;
  assertEquals(option.xAxis.axisLabel.customValues.length, 4);
  assertEquals(
    option.xAxis.axisLabel.formatter(first),
    "12 Nov 2024\nNorthside Pathology",
  );
  const [from] = option.series[0].markArea.data.at(-1);
  assertEquals([from.yAxis, from.label.formatter], [0, "< 35"]);

  const svg = echartsSvg(alt, PALETTE, LARGE, true);
  for (const text of ["12 Nov 2024", "Northside Pathology", "60", "&lt; 35"]) {
    assert(svg.includes(text), `the chart shows ${text}`);
  }
});
