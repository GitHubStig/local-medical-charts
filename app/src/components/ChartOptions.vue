<script setup lang="ts">
import { useId } from "vue";
import {
  CHART_CURVES,
  CHART_LIBRARIES,
  type ChartCurve,
  type ChartLibrary,
} from "../../../desktop/settings.ts";
import { useChartSettings } from "../composables/useChartSettings.ts";
import { CHART_BACKENDS } from "../lib/charts/backends.ts";
import Icon from "./Icon.vue";

/** `compact` hides the labels on narrower windows (screen readers still hear them). */
defineProps<{ compact?: boolean }>();

const { chartLibrary, chartCurve, setChartLibrary, setChartCurve } =
  useChartSettings();

const CURVE_LABELS: Record<ChartCurve, string> = {
  straight: "Straight",
  smooth: "Smooth",
  steps: "Steps",
};

// Ids are unique per copy: the options appear in the top bar and in the zoomed view.
const fields = [
  {
    id: useId(),
    label: "Chart library",
    value: chartLibrary,
    options: CHART_LIBRARIES.map((v) => ({ value: v, label: CHART_BACKENDS[v].label })),
    change: (value: string) => setChartLibrary(value as ChartLibrary),
  },
  {
    id: useId(),
    label: "Curve",
    value: chartCurve,
    options: CHART_CURVES.map((v) => ({ value: v, label: CURVE_LABELS[v] })),
    change: (value: string) => setChartCurve(value as ChartCurve),
  },
];
</script>

<template>
  <div class="flex max-w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
    <div v-for="field in fields" :key="field.label" class="flex items-center gap-2">
      <label
        :for="field.id"
        class="text-xs whitespace-nowrap text-muted"
        :class="{ 'max-xl:sr-only': compact }"
      >{{ field.label }}</label>
      <div class="relative">
        <select
          :id="field.id"
          :value="field.value.value"
          class="h-11 appearance-none rounded-lg border border-line bg-surface pr-9 pl-3 text-[13px] font-medium text-ink focus:border-line-strong"
          @change="field.change(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in field.options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <Icon
          name="chevron-down"
          class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-2"
        />
      </div>
    </div>
  </div>
</template>
