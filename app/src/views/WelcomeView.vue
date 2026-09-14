<script setup lang="ts">
import { useDropZone } from "@vueuse/core";
import { computed, ref } from "vue";
import AppLogo from "../components/AppLogo.vue";
import FilePickerButton from "../components/FilePickerButton.vue";
import Icon from "../components/Icon.vue";
import ImportResults from "../components/ImportResults.vue";
import ImportsPanel from "../components/ImportsPanel.vue";
import SettingsLink from "../components/SettingsLink.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import { useImports } from "../composables/useImports.ts";
import { useLibrary } from "../composables/useLibrary.ts";
import { useOcrSettings } from "../composables/useOcrSettings.ts";

const { busy, lastImport, mode } = useLibrary();
const { addFiles, starting } = useImports();
const { model } = useOcrSettings();

const working = computed(() => busy.value || starting.value);
const page = ref<HTMLElement | null>(null);

// The whole screen accepts drops; the card shows the drop state. Unhandled drops
// are cancelled so the window never navigates to a dropped file.
const { isOverDropZone } = useDropZone(page, {
  onDrop: (files) => files && addFiles(files),
  preventDefaultForUnhandled: true,
});

// Still on this screen after a JSON import means nothing could be filed.
const failedImport = computed(() => lastImport.value?.length ? lastImport.value : null);

const FORMATS = ["PDF", "JPG", "PNG", "WebP", "JSON"];
</script>

<template>
  <div
    ref="page"
    class="relative flex min-h-screen flex-col items-center justify-center px-6 py-16"
  >
    <div class="absolute right-6 top-6 flex items-center gap-3">
      <ThemeToggle />
      <SettingsLink />
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
        aria-label="Add reports"
        class="flex w-full flex-col items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-6 py-13 text-center transition-colors sm:px-10"
        :class="isOverDropZone ? 'border-series bg-series-wash' : 'border-line-strong bg-surface'"
      >
        <span class="flex size-14 items-center justify-center rounded-full bg-chip">
          <Icon name="upload" :size="24" class="text-ink" />
        </span>
        <h2 class="text-lg font-semibold">
          {{ working ? "Adding…" : isOverDropZone ? "Drop to add" : "Drop lab reports here" }}
        </h2>
        <p class="max-w-[460px] text-sm leading-normal text-ink-2">
          PDFs or photos of each page, one report or many at a time. Report JSON
          from the command line works too.
        </p>
        <ul class="flex flex-wrap justify-center gap-2" aria-label="File types">
          <li
            v-for="format in FORMATS"
            :key="format"
            class="rounded-full bg-chip px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink-2"
          >
            {{ format }}
          </li>
        </ul>
        <FilePickerButton
          :disabled="working"
          class="mt-1.5 flex h-11 items-center rounded-lg bg-ink px-4.5 text-sm font-medium text-page disabled:opacity-60"
          @files="addFiles"
        >
          Choose files
        </FilePickerButton>
      </section>

      <ImportsPanel />

      <div
        v-if="failedImport"
        role="alert"
        class="w-full rounded-xl border border-line bg-surface px-5 py-4"
      >
        <ImportResults :outcomes="failedImport" />
      </div>

      <div class="flex flex-col items-center gap-3">
        <p class="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-[13px] text-ink-2">
          <span>PDFs and photos are read by a vision model in Ollama on this computer.</span>
          <a href="#/settings" class="font-medium text-series hover:underline">
            {{ model ? "Settings" : "Set up in Settings" }}
          </a>
        </p>
        <p class="flex items-center gap-2 text-[13px] text-muted">
          <Icon name="lock" :size="14" />
          <span v-if="mode === 'fake'">
            Browser development: fictional sample data, kept in this tab only.
          </span>
          <span v-else>Stays on this computer, in a local SQLite database.</span>
        </p>
      </div>
    </main>
  </div>
</template>
