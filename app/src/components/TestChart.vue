<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useChartSettings } from "../composables/useChartSettings.ts";
import { useTheme } from "../composables/useTheme.ts";
import { CHART_BACKENDS } from "../lib/charts/backends.ts";
import type { ChartPalette } from "../lib/charts/palette.ts";
import type { ChartTooltip, RenderedChart } from "../lib/charts/types.ts";
import type { Series } from "../lib/series.ts";

const props = withDefaults(
  defineProps<{ series: Series; height?: number; axes?: boolean }>(),
  { height: 64, axes: false },
);

const element = ref<HTMLElement | null>(null);
const { width } = useElementSize(element);
const { resolved } = useTheme();
const { chartLibrary, chartCurve, chartTheme } = useChartSettings();
const tooltip = ref<ChartTooltip>(null);
const failed = ref<string | null>(null);
const chart = shallowRef<RenderedChart | null>(null);

/** The theme's chart colours, as they are right now. */
function readPalette(): ChartPalette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--mc-${name}`).trim();
  return {
    series: token("series"),
    band: token("band"),
    bandEdge: token("band-edge"),
    critical: token("critical"),
    surface: token("surface"),
    muted: token("muted"),
    grid: token("hairline"),
    axis: token("line-strong"),
    font: getComputedStyle(document.body).fontFamily,
  };
}

// Each render supersedes the last, so a slow one can't draw over a newer one.
let generation = 0;

async function draw() {
  const target = element.value;
  const w = Math.floor(width.value);
  if (!target || w <= 0) return;
  const mine = ++generation;
  try {
    // Each library loads on first use, so the main bundle carries none of them.
    const backend = await CHART_BACKENDS[chartLibrary.value].load();
    if (mine !== generation) return;
    chart.value?.destroy();
    chart.value = null;
    const rendered = await backend.render(target, props.series, {
      palette: readPalette(),
      curve: chartCurve.value,
      theme: chartTheme.value,
      width: w,
      height: props.height,
      axes: props.axes,
      onTooltip: (next) => (tooltip.value = next),
    });
    if (mine !== generation) return rendered.destroy();
    chart.value = rendered;
    failed.value = null;
  } catch (err) {
    failed.value = err instanceof Error ? err.message : String(err);
  }
}

// Redraw for new data, a new width, another chart library, curve or chart
// theme, or a light or dark switch (after <html data-theme> changes).
watch([
  () => props.series,
  width,
  resolved,
  chartLibrary,
  chartCurve,
  chartTheme,
], draw, {
  flush: "post",
});

onBeforeUnmount(() => {
  generation++;
  chart.value?.destroy();
});
</script>

<template>
  <div
    role="img"
    :aria-label="`${series.name} over time`"
    class="relative"
    :style="{ height: `${height}px` }"
  >
    <div ref="element" class="size-full" aria-hidden="true"></div>
    <p v-if="failed" class="absolute inset-0 flex items-center text-xs text-muted">
      Chart unavailable: {{ failed }}
    </p>
    <div
      v-if="tooltip"
      class="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-surface shadow-md"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y - 10}px` }"
    >
      {{ tooltip.text }}
    </div>
  </div>
</template>
