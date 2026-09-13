<script setup lang="ts">
import { ref } from "vue";
import AppLogo from "../components/AppLogo.vue";
import ImportResults from "../components/ImportResults.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import { useLibrary } from "../composables/useLibrary.ts";

// Placeholder until the dashboard is built: patients, adding reports, clearing.
const { patients, lastImport, busy, importFiles, clearAll, dismissImport } =
  useLibrary();

const picker = ref<HTMLInputElement | null>(null);

function onPick() {
  const files = [...(picker.value?.files ?? [])];
  if (picker.value) picker.value.value = "";
  if (files.length) importFiles(files);
}

function confirmClear() {
  if (confirm("Delete every patient and report from this app? Settings are kept.")) {
    clearAll();
  }
}

const dateOnly = (iso: string | null) => iso?.slice(0, 10) ?? "no date";
</script>

<template>
  <div class="min-h-screen">
    <header
      class="flex h-18 items-center justify-between gap-6 border-b border-line bg-surface px-10"
    >
      <div class="flex items-center gap-2.5">
        <AppLogo />
        <span class="text-[15px] font-semibold">Medical Charts</span>
      </div>
      <div class="flex items-center gap-4">
        <ThemeToggle />
        <input
          ref="picker"
          type="file"
          accept=".json,application/json"
          multiple
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          @change="onPick"
        />
        <button
          type="button"
          class="flex h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-page disabled:opacity-60"
          :disabled="busy"
          @click="picker?.click()"
        >
          Add reports
        </button>
        <button
          type="button"
          class="flex h-11 items-center rounded-lg border border-line px-3.5 text-sm font-medium text-danger disabled:opacity-60"
          :disabled="busy"
          @click="confirmClear"
        >
          Clear all data
        </button>
      </div>
    </header>

    <main class="mx-auto flex max-w-3xl flex-col gap-6 px-10 py-8">
      <div
        v-if="lastImport"
        role="status"
        class="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4"
      >
        <ImportResults :outcomes="lastImport" />
        <button
          type="button"
          class="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:text-ink"
          aria-label="Dismiss import results"
          @click="dismissImport"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <section class="flex flex-col gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Patients</h1>
        <ul class="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
          <li
            v-for="patient in patients"
            :key="patient.id"
            class="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
          >
            <span class="font-medium">{{ patient.name ?? "Unnamed patient" }}</span>
            <span class="text-ink-2">
              {{ patient.reportCount }} report{{ patient.reportCount === 1 ? "" : "s" }}
              · {{ dateOnly(patient.firstCollectedAt) }} to {{ dateOnly(patient.lastCollectedAt) }}
            </span>
          </li>
        </ul>
        <p class="text-sm text-muted">The dashboard with charts is on its way.</p>
      </section>
    </main>
  </div>
</template>
