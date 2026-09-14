<script setup lang="ts">
import { useId } from "vue";
import { useLibrary } from "../composables/useLibrary.ts";
import FilePickerButton from "./FilePickerButton.vue";
import Icon from "./Icon.vue";

// Shown while a patient has only one report: every chart is a single reading.
const { busy, importFiles } = useLibrary();
const headingId = useId();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4"
  >
    <div class="flex min-w-0 flex-1 basis-80 flex-col gap-1">
      <h2 :id="headingId" class="text-[15px] font-semibold">One report so far</h2>
      <p class="text-sm text-ink-2">
        Each chart shows a single reading against the lab’s range. Add a report from another date to see how
        results change.
      </p>
    </div>
    <FilePickerButton
      :disabled="busy"
      class="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium whitespace-nowrap text-page disabled:opacity-60"
      @files="importFiles"
    >
      <Icon name="plus" />
      Add reports
    </FilePickerButton>
  </section>
</template>
