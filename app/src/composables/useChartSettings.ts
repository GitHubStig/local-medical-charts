/**
 * How the dashboard's charts are drawn: the chart library and the line's curve.
 * Both are saved through the settings bindings, like the theme.
 */
import { readonly, ref } from "vue";
import type {
  ChartCurve,
  ChartLibrary,
  DesktopBindings,
  Settings,
} from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";

type ChartSettings = Pick<Settings, "chartLibrary" | "chartCurve">;

const chartLibrary = ref<ChartLibrary>("vega-lite");
const chartCurve = ref<ChartCurve>("straight");
const saveError = ref<string | null>(null);
let bindings: DesktopBindings | null = null;

function apply(settings: ChartSettings) {
  chartLibrary.value = settings.chartLibrary;
  chartCurve.value = settings.chartCurve;
}

/** Call once the bindings are connected, with the settings already loaded. */
export function initChartSettings(
  connected: DesktopBindings,
  settings: Settings,
): void {
  bindings = connected;
  apply(settings);
}

async function save(patch: Partial<ChartSettings>) {
  const previous = {
    chartLibrary: chartLibrary.value,
    chartCurve: chartCurve.value,
  };
  apply({ ...previous, ...patch }); // redraw immediately; undo if saving fails
  saveError.value = null;
  if (!bindings) return;
  try {
    apply(await bindings.updateSettings(patch));
  } catch (err) {
    apply(previous);
    saveError.value = errorMessage(err);
  }
}

export function useChartSettings() {
  return {
    chartLibrary: readonly(chartLibrary),
    chartCurve: readonly(chartCurve),
    saveError: readonly(saveError),
    setChartLibrary: (next: ChartLibrary) => save({ chartLibrary: next }),
    setChartCurve: (next: ChartCurve) => save({ chartCurve: next }),
  };
}
