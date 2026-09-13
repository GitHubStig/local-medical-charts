<script setup lang="ts">
import { CHART_LIBRARIES } from "../../../desktop/settings.ts";
import { useChartLibrary } from "../composables/useChartLibrary.ts";
import { CHART_BACKENDS } from "../lib/charts/backends.ts";

const { chartLibrary, setChartLibrary } = useChartLibrary();
</script>

<template>
  <div class="flex items-center gap-2.5">
    <span id="chart-library-label" class="text-xs whitespace-nowrap text-muted">Chart library</span>
    <div
      role="radiogroup"
      aria-labelledby="chart-library-label"
      class="flex gap-0.5 rounded-[9px] bg-chip p-[3px]"
    >
      <button
        v-for="library in CHART_LIBRARIES"
        :key="library"
        type="button"
        role="radio"
        :aria-checked="chartLibrary === library"
        class="flex h-[38px] items-center rounded-md px-3 text-[13px] whitespace-nowrap transition-colors"
        :class="chartLibrary === library
          ? 'bg-surface font-semibold text-ink shadow-sm'
          : 'font-medium text-ink-2 hover:text-ink'"
        @click="setChartLibrary(library)"
      >
        {{ CHART_BACKENDS[library].label }}
      </button>
    </div>
  </div>
</template>
