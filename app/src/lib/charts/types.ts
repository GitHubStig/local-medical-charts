/**
 * What every chart library backend works with. A backend turns a Series into
 * its own chart config (through Flint) and draws it into an element.
 *
 * Browser-only (DOM types); the spec builders stay free of them so Deno tests
 * can run them.
 */
import type { Series } from "../series.ts";
import type { ChartCurve } from "../../../../desktop/settings.ts";
import type { ChartPalette } from "./palette.ts";

/** Hover text and where the pointer is, in viewport pixels; null hides it. */
export type ChartTooltip = { text: string; x: number; y: number } | null;

export type ChartOptions = {
  palette: ChartPalette;
  /** How the line joins the readings. */
  curve: ChartCurve;
  /** The element's full size; axes, when shown, take their room from it. */
  width: number;
  height: number;
  /** Value and date axes, for the large chart; cards stay bare. */
  axes: boolean;
  onTooltip: (tooltip: ChartTooltip) => void;
};

export type RenderedChart = { destroy(): void };

export type ChartBackend = {
  render(
    element: HTMLElement,
    series: Series,
    options: ChartOptions,
  ): Promise<RenderedChart>;
};
