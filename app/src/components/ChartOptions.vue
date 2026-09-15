<script setup lang="ts">
import { computed, ref, useId, watchEffect } from "vue";
import {
  APP_CHART_THEME,
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

const {
  chartLibrary,
  chartCurve,
  chartTheme,
  setChartLibrary,
  setChartCurve,
  setChartTheme,
} = useChartSettings();

const CURVE_LABELS: Record<ChartCurve, string> = {
  straight: "Straight",
  smooth: "Smooth",
  steps: "Steps",
};

type Option = { value: string; label: string };

// Flint's themes load with the chart library, so Flint stays out of the main
// bundle. A theme the chosen library can't show yet says so; its charts keep
// the app's look.
const themes = ref<Option[]>([]);
watchEffect(async () => {
  const library = chartLibrary.value;
  const [{ chartThemes }, backend] = await Promise.all([
    import("../lib/charts/themes.ts"),
    CHART_BACKENDS[library].load(),
  ]);
  if (library !== chartLibrary.value) return;
  themes.value = chartThemes().map(({ id, label }) => ({
    value: id,
    label: id === APP_CHART_THEME || backend.supportsTheme(id)
      ? label
      : `${label} (not in ${CHART_BACKENDS[library].label} yet)`,
  }));
});

// Ids are unique per copy: the options appear in the top bar and in the zoomed view.
const ids = { library: useId(), curve: useId(), theme: useId() };

const fields = computed(() => {
  const themeOptions = themes.value.length
    ? themes.value
    : [{ value: APP_CHART_THEME, label: "App" }];
  return [
    {
      id: ids.library,
      label: "Chart library",
      value: chartLibrary.value,
      options: CHART_LIBRARIES.map((v) => ({ value: v, label: CHART_BACKENDS[v].label })),
      change: (value: string) => setChartLibrary(value as ChartLibrary),
    },
    {
      id: ids.curve,
      label: "Curve",
      value: chartCurve.value,
      options: CHART_CURVES.map((v) => ({ value: v, label: CURVE_LABELS[v] })),
      change: (value: string) => setChartCurve(value as ChartCurve),
    },
    {
      id: ids.theme,
      label: "Chart theme",
      // A saved theme this Flint no longer ships shows as App, as its charts do.
      value: themeOptions.some((t) => t.value === chartTheme.value)
        ? chartTheme.value
        : APP_CHART_THEME,
      options: themeOptions,
      // Theme names can be long ("Power BI (light)", "… (not in ECharts yet)"):
      // the closed dropdown truncates them so the top bar stays on one row.
      width: "max-w-44 truncate",
      change: (value: string) => setChartTheme(value),
    },
  ];
});
</script>

<template>
  <div class="flex max-w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
    <div v-for="field in fields" :key="field.id" class="flex items-center gap-2">
      <label
        :for="field.id"
        class="text-xs whitespace-nowrap text-muted"
        :class="{ 'max-xl:sr-only': compact }"
      >{{ field.label }}</label>
      <div class="relative">
        <select
          :id="field.id"
          :value="field.value"
          :class="field.width"
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
