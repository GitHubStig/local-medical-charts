<script setup lang="ts">
import type { DashboardReport } from "../../../desktop/contract.ts";
import ReportItem from "./ReportItem.vue";

defineProps<{ reports: readonly DashboardReport[] }>();
const emit = defineEmits<{ remove: [reportId: number] }>();
</script>

<template>
  <details open class="group/section rounded-xl border border-line bg-surface">
    <summary
      class="flex min-h-13 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 [&::-webkit-details-marker]:hidden"
    >
      <span class="flex items-center gap-2.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          class="-rotate-90 text-ink-2 transition-transform group-open/section:rotate-0"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <h2 class="text-[15px] font-semibold">Reports</h2>
        <span class="text-[13px] text-muted">{{ reports.length }}</span>
      </span>
      <span class="text-xs text-muted">Newest first</span>
    </summary>
    <div class="border-t border-line">
      <ReportItem
        v-for="(entry, index) in reports"
        :key="entry.id"
        :entry="entry"
        :initially-open="index === 0"
        @remove="emit('remove', $event)"
      />
    </div>
  </details>
</template>
