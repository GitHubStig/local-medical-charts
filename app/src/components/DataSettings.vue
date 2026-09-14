<script setup lang="ts">
import { useId } from "vue";
import { useLibrary } from "../composables/useLibrary.ts";
import Icon from "./Icon.vue";

const { patients, busy, clearAll } = useLibrary();
const headingId = useId();

function confirmClear() {
  if (
    confirm("Delete every patient and report from this app? Settings are kept.")
  ) {
    clearAll();
  }
}
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-4.5 rounded-xl border border-line bg-surface p-6"
  >
    <div class="flex flex-col gap-1.5">
      <h2 :id="headingId" class="text-[17px] font-semibold">Data</h2>
      <p class="text-sm text-ink-2">Patients, reports and settings are kept in a database on this computer.</p>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-hairline pt-4.5">
      <div class="flex flex-col gap-1">
        <span class="text-sm font-semibold">Clear all data</span>
        <span class="text-[13px] text-ink-2">
          {{
            patients.length
            ? "Deletes every patient and report. Settings are kept. This can’t be undone."
            : "Nothing stored yet."
          }}
        </span>
      </div>
      <button
        type="button"
        :disabled="busy || patients.length === 0"
        class="flex h-11 items-center gap-2 rounded-lg border border-danger-line bg-surface px-3.5 text-sm font-medium whitespace-nowrap text-danger disabled:opacity-60"
        @click="confirmClear"
      >
        <Icon name="trash" />
        Clear all data
      </button>
    </div>
  </section>
</template>
