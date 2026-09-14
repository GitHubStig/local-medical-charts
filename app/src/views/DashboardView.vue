<script setup lang="ts">
import { useDropZone } from "@vueuse/core";
import { computed, ref } from "vue";
import ImportResults from "../components/ImportResults.vue";
import ImportsPanel from "../components/ImportsPanel.vue";
import PatientSummary from "../components/PatientSummary.vue";
import SingleReportNotice from "../components/SingleReportNotice.vue";
import ReportsSection from "../components/ReportsSection.vue";
import TestGrid from "../components/TestGrid.vue";
import TopBar from "../components/TopBar.vue";
import { useImports } from "../composables/useImports.ts";
import { useLibrary } from "../composables/useLibrary.ts";
import { patientOverview } from "../lib/dashboard.ts";
import Icon from "../components/Icon.vue";

const {
  selectedPatientId,
  dashboard,
  lastImport,
  deleteReport,
  dismissImport,
} = useLibrary();
const { addFiles } = useImports();

// Only show a dashboard that belongs to the selected patient, never a stale one
// while the next is loading.
const current = computed(() =>
  dashboard.value?.patient.id === selectedPatientId.value ? dashboard.value : null
);
const overview = computed(() =>
  current.value ? patientOverview(current.value, new Date()) : null
);

function confirmRemove(reportId: number) {
  const entry = current.value?.reports.find((r) => r.id === reportId);
  const name = entry?.fileName ?? "this report";
  if (confirm(`Remove ${name} from this app? Its results disappear from the charts.`)) {
    deleteReport(reportId);
  }
}

// More reports can be dropped anywhere on the dashboard, as on the welcome screen.
const page = ref<HTMLElement | null>(null);
const { isOverDropZone } = useDropZone(page, {
  onDrop: (files) => files && addFiles(files),
  preventDefaultForUnhandled: true,
});
</script>

<template>
  <div ref="page" class="min-h-screen">
    <TopBar />

    <main class="mx-auto flex max-w-[1440px] flex-col gap-7 px-4 pt-8 pb-14 sm:px-10">
      <ImportsPanel />

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
          <Icon name="close" />
        </button>
      </div>

      <template v-if="current && overview">
        <PatientSummary :key="`summary-${current.patient.id}`" :overview="overview" />
        <SingleReportNotice v-if="overview.singleReport" />
        <!-- Keyed by patient, so expanded reports reset when switching patients. -->
        <ReportsSection
          :key="`reports-${current.patient.id}`"
          :reports="current.reports"
          @remove="confirmRemove"
        />
        <TestGrid :dashboard="current" />
      </template>
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
