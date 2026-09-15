/**
 * The Chart.js backend. Imported lazily, so Chart.js only loads when this
 * backend is in use. Only the pieces a line with markers needs are registered.
 */
import {
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import {
  chartjsConfig,
  type ChartjsPoint,
  supportsTheme,
} from "./chartjs-spec.ts";
import type { ChartBackend } from "./types.ts";

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

export const chartjs: ChartBackend = {
  supportsTheme,
  // Resolves once drawn: Chart.js draws synchronously when animation is off.
  // deno-lint-ignore require-await
  async render(
    element,
    series,
    { palette, curve, theme, width, height, axes, onTooltip },
  ) {
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    element.replaceChildren(canvas);

    const config = chartjsConfig(
      series,
      palette,
      { width, height },
      axes,
      curve,
      theme,
    );
    const options = config.options!;
    // Sharp on high-density screens: the canvas backs each CSS pixel with more.
    options.devicePixelRatio = globalThis.devicePixelRatio;
    options.plugins!.tooltip = {
      enabled: false,
      // The line itself has no hover target; only the markers answer.
      filter: (item) => item.datasetIndex > 0,
      external({ chart, tooltip }) {
        const [item] = tooltip.dataPoints ?? [];
        if (tooltip.opacity === 0 || !item) return onTooltip(null);
        const { left, top } = chart.canvas.getBoundingClientRect();
        onTooltip({
          text: (item.raw as ChartjsPoint).tooltip,
          x: left + tooltip.caretX,
          y: top + tooltip.caretY,
        });
      },
    };

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width;
    canvas.height = height;
    const chart = new Chart(canvas, config);
    return {
      destroy() {
        onTooltip(null);
        chart.destroy();
        element.replaceChildren();
      },
    };
  },
};
