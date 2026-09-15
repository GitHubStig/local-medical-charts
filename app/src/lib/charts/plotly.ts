/**
 * The Plotly backend, using Plotly's "basic" build (scatter, bar and pie),
 * which is all a line with markers needs. Imported lazily, so Plotly only
 * loads when this backend is in use.
 */
import Plotly from "plotly.js-basic-dist-min";
import { plotlyFigure } from "./plotly-spec.ts";
import type { ChartBackend } from "./types.ts";

type HoverEvent = {
  points?: { customdata?: unknown }[];
  event?: MouseEvent;
};

export const plotly: ChartBackend = {
  async render(
    element,
    series,
    { palette, curve, width, height, axes, onTooltip },
  ) {
    const { data, layout, config } = plotlyFigure(
      series,
      palette,
      { width, height },
      axes,
      curve,
    );
    const plot = await Plotly.newPlot(element, data, layout, config);
    plot.on("plotly_hover", (hover: HoverEvent) => {
      const text = hover.points?.[0]?.customdata;
      if (typeof text === "string" && hover.event) {
        onTooltip({ text, x: hover.event.clientX, y: hover.event.clientY });
      }
    });
    plot.on("plotly_unhover", () => onTooltip(null));
    return {
      destroy() {
        onTooltip(null);
        Plotly.purge(element);
        element.replaceChildren();
      },
    };
  },
};
