<script setup lang="ts">
import { useId } from "vue";

// Shown while a patient has only one report: every chart is a single reading.
// Reports are added from the top bar, which stays in view.
const headingId = useId();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-1 rounded-xl border border-line bg-surface px-5 py-4"
  >
    <h2 :id="headingId" class="text-[15px] font-semibold">One report so far</h2>
    <p class="text-sm text-ink-2">
      Each chart shows a single reading against the lab’s range. Add a report from another date to see how
      results change.
    </p>
  </section>
</template>
