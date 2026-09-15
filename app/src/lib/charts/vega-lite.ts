/**
 * The Vega-Lite backend. Imported lazily, so Vega only loads when this backend
 * is in use.
 */
import type { ChartBackend } from "./types.ts";
import { vegaLiteSpec, vegaView } from "./vega-lite-spec.ts";

export const vegaLite: ChartBackend = {
  async render(
    element,
    series,
    { palette, curve, width, height, axes, onTooltip },
  ) {
    const spec = vegaLiteSpec(
      series,
      palette,
      { width, height },
      axes,
      curve,
    );
    const view = vegaView(spec, element);
    view.tooltip((
      _handler: unknown,
      event: MouseEvent,
      _item: unknown,
      value: unknown,
    ) =>
      onTooltip(
        value == null
          ? null
          : { text: String(value), x: event.clientX, y: event.clientY },
      )
    );
    await view.runAsync();
    return {
      destroy() {
        onTooltip(null);
        view.finalize();
        element.replaceChildren();
      },
    };
  },
};
