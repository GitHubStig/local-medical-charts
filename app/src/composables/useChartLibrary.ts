/**
 * Which chart library draws the dashboard's charts. The choice is saved through
 * the settings bindings, like the theme.
 */
import { readonly, ref } from "vue";
import type {
  ChartLibrary,
  DesktopBindings,
  Settings,
} from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";

const chartLibrary = ref<ChartLibrary>("vega-lite");
const saveError = ref<string | null>(null);
let bindings: DesktopBindings | null = null;

/** Call once the bindings are connected, with the settings already loaded. */
export function initChartLibrary(
  connected: DesktopBindings,
  settings: Settings,
): void {
  bindings = connected;
  chartLibrary.value = settings.chartLibrary;
}

export function useChartLibrary() {
  async function setChartLibrary(next: ChartLibrary) {
    const previous = chartLibrary.value;
    chartLibrary.value = next; // redraw immediately; undo if saving fails
    saveError.value = null;
    if (!bindings) return;
    try {
      chartLibrary.value =
        (await bindings.updateSettings({ chartLibrary: next })).chartLibrary;
    } catch (err) {
      chartLibrary.value = previous;
      saveError.value = errorMessage(err);
    }
  }

  return {
    chartLibrary: readonly(chartLibrary),
    saveError: readonly(saveError),
    setChartLibrary,
  };
}
