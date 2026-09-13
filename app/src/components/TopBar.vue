<script setup lang="ts">
import { useLibrary } from "../composables/useLibrary.ts";
import AppLogo from "./AppLogo.vue";
import ChartLibraryToggle from "./ChartLibraryToggle.vue";
import FilePickerButton from "./FilePickerButton.vue";
import PatientPicker from "./PatientPicker.vue";
import ThemeToggle from "./ThemeToggle.vue";
import Icon from "./Icon.vue";

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
  <!-- Sticky, so the chart library and theme stay in reach while scrolling. -->
  <header
    class="sticky top-0 z-20 flex h-18 items-center justify-between gap-6 border-b border-line bg-surface px-10"
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
      <ChartLibraryToggle />
      <ThemeToggle compact />
      <FilePickerButton
        :disabled="busy"
        class="flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium whitespace-nowrap text-page disabled:opacity-60"
        @files="importFiles"
      >
        <Icon name="plus" />
        Add reports
      </FilePickerButton>
      <button
        type="button"
        :disabled="busy"
        class="flex h-11 items-center gap-2 rounded-lg border border-danger-line px-3.5 text-sm font-medium whitespace-nowrap text-danger disabled:opacity-60"
        @click="confirmClear"
      >
        <Icon name="trash" />
        Clear all data
      </button>
    </div>
  </header>
</template>
