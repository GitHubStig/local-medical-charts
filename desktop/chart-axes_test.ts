import { assertEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import { chartAxes } from "../app/src/lib/charts/axes.ts";
import { buildSeries, dateMs, type Series } from "../app/src/lib/series.ts";

// Uses the fictional sample reports (samples/).

async function sampleSeries(patient: string, key: string): Promise<Series> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const found = (await b.listPatients()).find((p) => p.name === patient)!;
  return buildSeries((await b.getDashboard(found.id))!).get(key)!;
}

const WIDE = 968;

Deno.test("the value scale sits on round numbers that cover the whole window", async () => {
  const alt = chartAxes(await sampleSeries("ALEX TAN", "alt"), WIDE)!;
  assertEquals(alt.y, { domain: [0, 60], ticks: [0, 20, 40, 60], step: 20 });

  const hb = chartAxes(await sampleSeries("ALEX TAN", "haemoglobin"), WIDE)!;
  assertEquals(hb.y, {
    domain: [10, 18],
    ticks: [10, 12, 14, 16, 18],
    step: 2,
  });

  // Small values keep tidy decimals, without floating-point noise.
  const hba1c = chartAxes(await sampleSeries("ALEX TAN", "hba1c"), WIDE)!;
  assertEquals(hba1c.y.ticks, [5.4, 5.6, 5.8, 6, 6.2]);
});

Deno.test("each reading gets its date and lab under the chart, thinned when space is short", async () => {
  const alt = await sampleSeries("ALEX TAN", "alt");
  assertEquals(chartAxes(alt, WIDE)!.x.ticks, [
    {
      value: dateMs("2024-11-12T08:40:00"),
      lines: ["12 Nov 2024", "Northside Pathology"],
    },
    {
      value: dateMs("2025-05-20T08:40:00"),
      lines: ["20 May 2025", "Northside Pathology"],
    },
    {
      value: dateMs("2025-10-03T08:40:00"),
      lines: ["3 Oct 2025", "Harbour Medical Lab"],
    },
    {
      value: dateMs("2026-03-18T08:40:00"),
      lines: ["18 Mar 2026", "Harbour Medical Lab"],
    },
  ]);

  // Room for two labels: the first and the latest.
  assertEquals(
    chartAxes(alt, 250)!.x.ticks.map((tick) => tick.lines[0]),
    ["12 Nov 2024", "18 Mar 2026"],
  );
  assertEquals(
    chartAxes(alt, 100)!.x.ticks.map((tick) => tick.lines[0]),
    ["18 Mar 2026"],
  );
});

Deno.test("the latest lab range is labelled at the middle of its band", async () => {
  // Harbour's < 35 is open at the bottom, so it runs down to the scale's 0.
  assertEquals(
    chartAxes(await sampleSeries("ALEX TAN", "alt"), WIDE)!.rangeLabel,
    { text: "< 35", y: 17.5 },
  );
  assertEquals(
    chartAxes(await sampleSeries("ALEX TAN", "haemoglobin"), WIDE)!.rangeLabel,
    { text: "12 – 15.5", y: 13.75 },
  );
  // Banded ranges have no band to label; nor does a latest reading without a range.
  assertEquals(
    chartAxes(await sampleSeries("ALEX TAN", "hba1c"), WIDE)!.rangeLabel,
    null,
  );
  assertEquals(
    chartAxes(await sampleSeries("ALEX TAN", "neutrophils_pct"), WIDE)!
      .rangeLabel,
    null,
  );
});

Deno.test("a lone reading gets a single date label", async () => {
  const hb = chartAxes(await sampleSeries("SAM RIVERA", "haemoglobin"), WIDE)!;
  assertEquals(hb.x.ticks.map((tick) => tick.lines), [[
    "7 Aug 2026",
    "Northside Pathology",
  ]]);
  assertEquals(hb.rangeLabel, { text: "11.5 – 16", y: 13.75 });
});
