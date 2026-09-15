/**
 * The ECharts backend. Imported lazily, so ECharts only loads when this backend
 * is in use.
 */
import {
  echartsInstance,
  echartsOption,
  HOVER_TARGETS,
  supportsTheme,
} from "./echarts-spec.ts";
import type { ChartBackend } from "./types.ts";

type HoverEvent = {
  data?: { tooltip?: string };
  event?: { event?: MouseEvent };
};

export const echarts: ChartBackend = {
  supportsTheme,
  // Resolves once drawn: ECharts renders synchronously when animation is off.
  // deno-lint-ignore require-await
  async render(
    element,
    series,
    { palette, curve, theme, width, height, axes, onTooltip },
  ) {
    const size = { width, height };
    const chart = echartsInstance(size, element);
    chart.setOption(echartsOption(series, palette, size, axes, curve, theme));
    chart.on("mouseover", { seriesId: HOVER_TARGETS }, (params: unknown) => {
      const { data, event } = params as HoverEvent;
      const pointer = event?.event;
      if (data?.tooltip && pointer) {
        onTooltip({
          text: data.tooltip,
          x: pointer.clientX,
          y: pointer.clientY,
        });
      }
    });
    chart.on("mouseout", { seriesId: HOVER_TARGETS }, () => onTooltip(null));
    chart.on("globalout", () => onTooltip(null));
    return {
      destroy() {
        onTooltip(null);
        chart.dispose();
        element.replaceChildren();
      },
    };
  },
};
