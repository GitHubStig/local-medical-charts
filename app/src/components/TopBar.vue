<script setup lang="ts">
import { useLibrary } from "../composables/useLibrary.ts";
import AppLogo from "./AppLogo.vue";
import FilePickerButton from "./FilePickerButton.vue";
import PatientPicker from "./PatientPicker.vue";
import ThemeToggle from "./ThemeToggle.vue";

const {
  patients,
  selectedPatientId,
  selectPatient,
  busy,
  importFiles,
  clearAll,
} = useLibrary();

function confirmClear() {
  if (
    confirm("Delete every patient and report from this app? Settings are kept.")
  ) {
    clearAll();
  }
}
</script>

<template>
  <header
    class="flex h-18 items-center justify-between gap-6 border-b border-line bg-surface px-10"
  >
    <div class="flex items-center gap-5">
      <div class="flex items-center gap-2.5">
        <AppLogo />
        <span class="text-[15px] font-semibold whitespace-nowrap">Medical Charts</span>
      </div>
      <span class="h-7 w-px bg-line" aria-hidden="true"></span>
      <PatientPicker
        :patients="patients"
        :selected-id="selectedPatientId"
        @select="selectPatient"
      />
    </div>

    <div class="flex items-center gap-4">
      <ThemeToggle compact />
      <FilePickerButton
        :disabled="busy"
        class="flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium whitespace-nowrap text-page disabled:opacity-60"
        @files="importFiles"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        Add reports
      </FilePickerButton>
      <button
        type="button"
        :disabled="busy"
        class="flex h-11 items-center gap-2 rounded-lg border border-danger-line px-3.5 text-sm font-medium whitespace-nowrap text-danger disabled:opacity-60"
        @click="confirmClear"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 4h11M6 4V2.8h4V4M4 4l.7 9.2h6.6L12 4"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Clear all data
      </button>
    </div>
  </header>
</template>
