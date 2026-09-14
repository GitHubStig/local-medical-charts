<script setup lang="ts">
import { useImports } from "../composables/useImports.ts";
import { useLibrary } from "../composables/useLibrary.ts";
import AppLogo from "./AppLogo.vue";
import ChartLibraryToggle from "./ChartLibraryToggle.vue";
import FilePickerButton from "./FilePickerButton.vue";
import PatientPicker from "./PatientPicker.vue";
import SettingsLink from "./SettingsLink.vue";
import ThemeToggle from "./ThemeToggle.vue";
import Icon from "./Icon.vue";

/** `active` marks the page the bar sits on, e.g. the settings gear while on Settings. */
defineProps<{ active?: "settings" }>();

const { patients, selectedPatientId, selectPatient, busy } = useLibrary();
const { addFiles, starting } = useImports();
</script>

<template>
  <!--
    Sticky from tablet width up, so the chart library and theme stay in reach while
    scrolling. On a phone the bar wraps onto several rows, which would pin too much
    of the screen, so there it scrolls away with the page.
  -->
  <header
    class="z-20 flex min-h-18 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3.5 sm:px-10 md:sticky md:top-0"
  >
    <div class="flex min-w-0 items-center gap-5">
      <div class="flex items-center gap-2.5">
        <AppLogo />
        <span class="text-[15px] font-semibold whitespace-nowrap max-md:sr-only">Medical Charts</span>
      </div>
      <span v-if="patients.length" class="h-7 w-px bg-line max-md:hidden" aria-hidden="true"></span>
      <PatientPicker
        v-if="patients.length"
        :patients="patients"
        :selected-id="selectedPatientId"
        @select="selectPatient"
      />
    </div>

    <!-- Narrower windows drop the words and keep the icons; names stay for screen readers. -->
    <div class="flex flex-wrap items-center gap-3 lg:gap-4">
      <ChartLibraryToggle compact />
      <ThemeToggle compact />
      <FilePickerButton
        :disabled="busy || starting"
        title="Add reports"
        class="flex h-11 items-center gap-2 rounded-lg bg-ink px-3.5 text-sm font-medium whitespace-nowrap text-page disabled:opacity-60 lg:px-4"
        @files="addFiles"
      >
        <Icon name="plus" />
        <span class="max-lg:sr-only">Add reports</span>
      </FilePickerButton>
      <SettingsLink :active="active === 'settings'" />
    </div>
  </header>
</template>
