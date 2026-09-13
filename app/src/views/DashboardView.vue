<script setup lang="ts">
import { useDropZone } from "@vueuse/core";
import { ref } from "vue";
import ImportResults from "../components/ImportResults.vue";
import TopBar from "../components/TopBar.vue";
import { useLibrary } from "../composables/useLibrary.ts";
import { displayName } from "../lib/format.ts";

const { selectedPatient, lastImport, importFiles, dismissImport } = useLibrary();

// More reports can be dropped anywhere on the dashboard, as on the welcome screen.
const page = ref<HTMLElement | null>(null);
const { isOverDropZone } = useDropZone(page, {
  onDrop: (files) => files && importFiles(files),
  preventDefaultForUnhandled: true,
});
</script>

<template>
  <div ref="page" class="min-h-screen">
    <TopBar />

    <main class="mx-auto flex max-w-3xl flex-col gap-6 px-10 py-8">
      <div
        v-if="lastImport"
        role="status"
        class="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4"
      >
        <ImportResults :outcomes="lastImport" />
        <button
          type="button"
          class="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:text-ink"
          aria-label="Dismiss import results"
          @click="dismissImport"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <section v-if="selectedPatient" class="flex flex-col gap-2">
        <h1 class="text-[28px] font-semibold tracking-tight">
          {{ displayName(selectedPatient.name) }}
        </h1>
        <p class="text-sm text-muted">
          The patient summary, reports and charts are on their way.
        </p>
      </section>
    </main>

    <div
      v-if="isOverDropZone"
      class="pointer-events-none fixed inset-4 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-series bg-series-wash backdrop-blur-[2px]"
    >
      <p class="rounded-lg bg-surface px-5 py-3 text-base font-semibold shadow-lg">
        Drop to add reports
      </p>
    </div>
  </div>
</template>
