<script setup lang="ts">
import { useDropZone } from "@vueuse/core";
import { computed, ref } from "vue";
import AppLogo from "../components/AppLogo.vue";
import FilePickerButton from "../components/FilePickerButton.vue";
import ImportResults from "../components/ImportResults.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import { useLibrary } from "../composables/useLibrary.ts";

const { busy, lastImport, mode, importFiles } = useLibrary();

const page = ref<HTMLElement | null>(null);

// The whole screen accepts drops; the card shows the drop state. Unhandled drops
// are cancelled so the window never navigates to a dropped file.
const { isOverDropZone } = useDropZone(page, {
  onDrop: (files) => files && importFiles(files),
  preventDefaultForUnhandled: true,
});

// Still on this screen after an import means nothing could be filed.
const failedImport = computed(() => lastImport.value?.length ? lastImport.value : null);
</script>

<template>
  <div
    ref="page"
    class="relative flex min-h-screen flex-col items-center justify-center px-6 py-16"
  >
    <div class="absolute right-6 top-6">
      <ThemeToggle />
    </div>

    <main class="flex w-full max-w-[640px] flex-col items-center gap-8">
      <div class="flex flex-col items-center gap-3.5 text-center">
        <AppLogo :size="48" />
        <h1 class="text-[30px] font-semibold tracking-tight">Medical Charts</h1>
        <p class="text-base leading-normal text-ink-2">
          See how lab results change over time, across every report and lab.
        </p>
      </div>

      <section
        aria-label="Import reports"
        class="flex w-full flex-col items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-10 py-13 text-center transition-colors"
        :class="isOverDropZone ? 'border-series bg-series-wash' : 'border-line-strong bg-surface'"
      >
        <span class="flex size-14 items-center justify-center rounded-full bg-chip">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="text-ink">
            <path
              d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 15v3.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V15"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <h2 class="text-lg font-semibold">
          {{ busy ? "Importing…" : isOverDropZone ? "Drop to import" : "Drop report files here" }}
        </h2>
        <p class="max-w-[440px] text-sm leading-normal text-ink-2">
          Merged report JSON from the OCR pipeline, one or many at a time.
          Per-page files are skipped.
        </p>
        <FilePickerButton
          :disabled="busy"
          class="mt-1.5 flex h-11 items-center rounded-lg bg-ink px-4.5 text-sm font-medium text-page disabled:opacity-60"
          @files="importFiles"
        >
          Choose files
        </FilePickerButton>
      </section>

      <div
        v-if="failedImport"
        role="alert"
        class="w-full rounded-xl border border-line bg-surface px-5 py-4"
      >
        <ImportResults :outcomes="failedImport" />
      </div>

      <p class="flex items-center gap-2 text-[13px] text-muted">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="2.5" y="6" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" stroke-width="1.3" />
        </svg>
        <span v-if="mode === 'fake'">
          Browser development: fictional sample data, kept in this tab only.
        </span>
        <span v-else>Stays on this computer, in a local SQLite database.</span>
      </p>
    </main>
  </div>
</template>
