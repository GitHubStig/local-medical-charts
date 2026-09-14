<script setup lang="ts">
import { useId } from "vue";
import { CHART_LIBRARIES } from "../../../desktop/settings.ts";
import { useChartLibrary } from "../composables/useChartLibrary.ts";
import { CHART_BACKENDS } from "../lib/charts/backends.ts";

/** `compact` hides the "Chart library" label on narrower windows (screen readers still hear it). */
defineProps<{ compact?: boolean }>();

const { chartLibrary, setChartLibrary } = useChartLibrary();
// Unique per copy: the switcher appears in the top bar and in the zoomed view.
const labelId = useId();
</script>

<template>
  <!-- Wraps the label above the options, and scrolls the options, when space is short. -->
  <div class="flex max-w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
    <span
      :id="labelId"
      class="text-xs whitespace-nowrap text-muted"
      :class="{ 'max-xl:sr-only': compact }"
    >Chart library</span>
    <div
      role="radiogroup"
      :aria-labelledby="labelId"
      class="flex max-w-full gap-0.5 overflow-x-auto rounded-[9px] bg-chip p-[3px]"
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
