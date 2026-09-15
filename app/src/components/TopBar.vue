<script setup lang="ts">
import { useImports } from "../composables/useImports.ts";
import { useLibrary } from "../composables/useLibrary.ts";
import AppLogo from "./AppLogo.vue";
import ChartOptions from "./ChartOptions.vue";
import FilePickerButton from "./FilePickerButton.vue";
import PatientPicker from "./PatientPicker.vue";
import ProgressLine from "./ProgressLine.vue";
import SettingsLink from "./SettingsLink.vue";
import ThemeToggle from "./ThemeToggle.vue";
import Icon from "./Icon.vue";

/**
 * `active` marks the page the bar sits on. Settings and review aren't about the
 * patient the dashboard shows (a report under review may be someone else's), so
 * both leave the patient picker out.
 */
defineProps<{ active?: "settings" | "review" }>();

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
    class="relative z-20 flex min-h-18 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3.5 sm:px-10 md:sticky md:top-0"
  >
    <div class="flex min-w-0 items-center gap-5">
      <div class="flex items-center gap-2.5">
        <AppLogo />
        <span class="text-[15px] font-semibold whitespace-nowrap max-2xl:sr-only">Local Medical Charts</span>
      </div>
      <span v-if="patients.length && !active" class="h-7 w-px bg-line max-md:hidden" aria-hidden="true"></span>
      <PatientPicker
        v-if="patients.length && !active"
        :patients="patients"
        :selected-id="selectedPatientId"
        @select="selectPatient"
      />
    </div>

    <!--
      Narrower windows drop the words and keep the icons; names stay for screen readers.
      Settings has no charts and adds no reports, so it leaves those two out.
    -->
    <div class="flex flex-wrap items-center gap-3 lg:gap-4">
      <ChartOptions v-if="active !== 'settings'" compact />
      <ThemeToggle compact />
      <FilePickerButton
        v-if="active !== 'settings'"
        :disabled="busy || starting"
        title="Add reports"
        class="flex h-11 items-center gap-2 rounded-lg bg-ink px-3.5 text-sm font-medium whitespace-nowrap text-page disabled:opacity-60 lg:px-4"
        @files="addFiles"
      >
        <Icon name="plus" />
        <span class="max-lg:sr-only">{{ busy || starting ? "Adding…" : "Add reports" }}</span>
      </FilePickerButton>
      <SettingsLink :active="active === 'settings'" />
    </div>

    <ProgressLine class="absolute inset-x-0 -bottom-px" />
  </header>
</template>
