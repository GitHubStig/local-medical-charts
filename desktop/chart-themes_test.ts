import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { createFakeBindings } from "../app/src/api/fake-bindings.ts";
import { SAMPLE_REPORTS } from "../app/src/api/samples.ts";
import {
  chartjsConfig,
  supportsTheme as chartjsSupports,
} from "../app/src/lib/charts/chartjs-spec.ts";
import {
  echartsOption,
  supportsTheme as echartsSupports,
} from "../app/src/lib/charts/echarts-spec.ts";
import {
  plotlyFigure,
  supportsTheme as plotlySupports,
} from "../app/src/lib/charts/plotly-spec.ts";
import {
  APP_THEME,
  chartThemes,
  mixColour,
  themePalette,
} from "../app/src/lib/charts/themes.ts";
import {
  supportsTheme as vegaLiteSupports,
  vegaLiteSpec,
} from "../app/src/lib/charts/vega-lite-spec.ts";
import { buildSeries, type Series } from "../app/src/lib/series.ts";

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
const LARGE = { width: 1088, height: 320 };
const SIZE = { width: 294, height: 64 };

async function alexSeries(key: string): Promise<Series> {
  const b = createFakeBindings({ reports: SAMPLE_REPORTS });
  const alex = (await b.listPatients()).find((p) => p.name === "ALEX TAN")!;
  return buildSeries((await b.getDashboard(alex.id))!).get(key)!;
}

// deno-lint-ignore no-explicit-any
type Loose = any;
const FLINT_THEMES = chartThemes().filter((t) => t.id !== APP_THEME);

Deno.test("the themes are the app's own look, then every theme Flint ships", () => {
  const themes = chartThemes();
  assertEquals(themes[0], { id: APP_THEME, label: "App" });
  assert(FLINT_THEMES.length > 0, "Flint ships no themes");
  assertEquals(new Set(themes.map((t) => t.id)).size, themes.length);
});

// This is the list to check after updating Flint or a chart library: when
// Flint starts theming ECharts or Chart.js, this test fails on purpose. Give
// that library's overlay the same themed branch as vega-lite-spec.ts, then
// move it to the supported list (docs/development.md, "Chart themes").
Deno.test("Flint themes Vega-Lite and Plotly for every theme; ECharts and Chart.js not yet", () => {
  const libraries = [
    ["Vega-Lite", vegaLiteSupports, true],
    ["Plotly", plotlySupports, true],
    ["ECharts", echartsSupports, false],
    ["Chart.js", chartjsSupports, false],
  ] as const;
  for (const [library, supports, expected] of libraries) {
    assertEquals(supports(APP_THEME), false, `${library} and the app theme`);
    assertEquals(supports("no-such-theme"), false, `${library}, unknown theme`);
    for (const { id } of FLINT_THEMES) {
      assertEquals(
        supports(id),
        expected,
        expected
          ? `Flint no longer themes ${library} for "${id}"`
          : `Flint now themes ${library} for "${id}": see docs/development.md, "Chart themes"`,
      );
    }
  }
});

Deno.test("naming the app theme changes nothing", async () => {
  const alt = await alexSeries("alt");
  assertEquals(
    vegaLiteSpec(alt, PALETTE, LARGE, true, "smooth", APP_THEME),
    vegaLiteSpec(alt, PALETTE, LARGE, true),
  );
  assertEquals(
    plotlyFigure(alt, PALETTE, LARGE, true, "smooth", APP_THEME),
    plotlyFigure(alt, PALETTE, LARGE, true),
  );
});

Deno.test("a themed Vega-Lite chart takes Flint's styling and keeps the app's flags, bounds and bands", async () => {
  const alt = await alexSeries("alt");
  const spec = vegaLiteSpec(
    alt,
    PALETTE,
    LARGE,
    true,
    "smooth",
    "economist",
  ) as Loose;
  const app = vegaLiteSpec(alt, PALETTE, LARGE, true) as Loose;
  const [bands, , line, filled, hollow] = spec.layer;

  // Flint's: the surface, the line's colour and weight, and the axis styling.
  assertEquals(spec.background, "#ffffff");
  assertEquals(line.mark.color, "#006ba2");
  assertEquals(line.mark.strokeWidth, undefined);
  assertEquals(spec.config.line.strokeWidth, 1.6);
  assertEquals(line.encoding.x.axis.domainColor, undefined);
  assertEquals(line.encoding.y.axis.gridColor, undefined);
  // The app's: ticks at the readings, flags, hollow bounds and the bands.
  assertEquals(
    line.encoding.x.axis.values,
    app.layer[2].encoding.x.axis.values,
  );
  // The theme's own tick count (3 for The Economist) mustn't thin the ticks.
  const { values, tickCount } = line.encoding.y.axis;
  assertEquals([values.length, tickCount], [4, 4]);
  assertEquals(filled.encoding.fill.condition.value, PALETTE.critical);
  assertEquals(hollow.mark.filled, false);
  // Themed bands stop a pixel inside the plot, so the theme's axis lines show.
  const [appBand] = app.layer[0].data.values;
  const [themedBand] = bands.data.values;
  assertEquals(bands.data.values.length, app.layer[0].data.values.length);
  assert(themedBand.start > appBand.start && themedBand.low > appBand.low);
  assert(themedBand.high === appBand.high);
  assertNotEquals(bands.mark.color, PALETTE.band);
});

Deno.test("a themed Plotly chart takes Flint's styling and keeps the app's flags, bounds and bands", async () => {
  const alt = await alexSeries("alt");
  const figure = plotlyFigure(
    alt,
    PALETTE,
    LARGE,
    true,
    "smooth",
    "economist",
  ) as Loose;
  const app = plotlyFigure(alt, PALETTE, LARGE, true) as Loose;
  const [line, filled, hollow] = figure.data;

  assertEquals(figure.layout.paper_bgcolor, "#ffffff");
  assertEquals([line.line.color, line.line.width], ["#006ba2", 1.6]);
  assertEquals(figure.layout.xaxis.linecolor, "#121317");
  assertEquals(figure.layout.xaxis.tickvals, app.layout.xaxis.tickvals);
  assert(filled.marker.color.includes(PALETTE.critical));
  assertEquals(hollow.marker.color, "#ffffff");
  assertEquals(figure.layout.shapes.length, app.layout.shapes.length);
  assertNotEquals(figure.layout.shapes[0].fillcolor, PALETTE.band);
});

Deno.test("ECharts and Chart.js keep the app's look when Flint doesn't theme them", async () => {
  const alt = await alexSeries("alt");
  const json = (value: unknown) => JSON.stringify(value);
  assertEquals(
    json(echartsOption(alt, PALETTE, SIZE, false, "smooth", "economist")),
    json(echartsOption(alt, PALETTE, SIZE, false)),
  );
  assertEquals(
    json(chartjsConfig(alt, PALETTE, SIZE, false, "smooth", "economist")),
    json(chartjsConfig(alt, PALETTE, SIZE, false)),
  );
});

Deno.test("a theme's colours: its surface and ink, bands mixed from them, the app's flag colour", () => {
  const palette = themePalette("swiss", PALETTE, {
    surface: "#f4f1ea",
    font: "Helvetica, sans-serif",
    series: "#e2231a",
  });
  assertEquals(palette.surface, "#f4f1ea");
  assertEquals(palette.series, "#e2231a");
  assertEquals(palette.font, "Helvetica, sans-serif");
  assertEquals(palette.muted, "#555555");
  assertEquals(palette.critical, PALETTE.critical);
  assertEquals(palette.band, mixColour("#f4f1ea", "#1a1a1a", 0.08));

  assertEquals(mixColour("#ffffff", "#000000", 0.5), "#808080");
  assertEquals(mixColour("#fff", "#00000000", 0), "#ffffff");
  assertEquals(mixColour("white", "#000", 0.5), null);
});
