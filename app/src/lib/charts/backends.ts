/**
 * The chart libraries the dashboard can switch between. Each backend is its own
 * lazily loaded chunk, so only the libraries someone actually picks are loaded.
 */
import type { ChartLibrary } from "../../../../desktop/settings.ts";
import type { ChartBackend } from "./types.ts";

export const CHART_BACKENDS: Record<
  ChartLibrary,
  { label: string; load: () => Promise<ChartBackend> }
> = {
  "vega-lite": {
    label: "Vega-Lite",
    load: () => import("./vega-lite.ts").then((m) => m.vegaLite),
  },
  echarts: {
    label: "ECharts",
    load: () => import("./echarts.ts").then((m) => m.echarts),
  },
  chartjs: {
    label: "Chart.js",
    load: () => import("./chartjs.ts").then((m) => m.chartjs),
  },
};
