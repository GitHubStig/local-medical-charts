<script setup lang="ts">
import { ref, watch } from "vue";
import { useActivity } from "../composables/useActivity.ts";

// A thin line that fills as added files are read and handed over. It finishes
// the fill before fading, so quick work still reads as done. The parent places it.
const { activity } = useActivity();

const shown = ref(false);
const share = ref(0);
const label = ref("Adding reports");
let hide: ReturnType<typeof setTimeout> | undefined;

watch(activity, (now) => {
  clearTimeout(hide);
  if (now) {
    shown.value = true;
    label.value = now.label;
    share.value = now.done / now.total;
  } else if (shown.value) {
    share.value = 1;
    hide = setTimeout(() => {
      shown.value = false;
      share.value = 0;
    }, 450);
  }
}, { immediate: true });
</script>

<template>
  <div
    role="progressbar"
    :aria-hidden="!shown"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(share * 100)"
    class="pointer-events-none h-0.5 overflow-hidden transition-opacity duration-300"
    :class="shown ? 'opacity-100' : 'opacity-0'"
  >
    <!-- A sliver shows from the start, so waiting on the first file still looks alive. -->
    <div
      class="h-full origin-left bg-series transition-transform duration-300 ease-out"
      :style="{ transform: `scaleX(${shown ? Math.max(share, 0.04) : 0})` }"
    ></div>
  </div>
</template>
