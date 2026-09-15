<script setup lang="ts">
import type { DashboardReport } from "../../../desktop/contract.ts";
import { useFolds } from "../composables/useFolds.ts";
import ReportItem from "./ReportItem.vue";
import Icon from "./Icon.vue";

defineProps<{ reports: readonly DashboardReport[]; patientId: number }>();
const emit = defineEmits<{ remove: [reportId: number] }>();

const { isOpen, setOpen } = useFolds();
</script>

<template>
  <details
    :open="isOpen(patientId, 'reports', true)"
    class="group/section rounded-xl border border-line bg-surface"
    @toggle="setOpen(patientId, 'reports', ($event.target as HTMLDetailsElement).open)"
  >
    <summary
      class="flex min-h-13 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 [&::-webkit-details-marker]:hidden"
    >
      <span class="flex items-center gap-2.5">
        <Icon name="chevron-down" class="-rotate-90 text-ink-2 transition-transform group-open/section:rotate-0" />
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
        :patient-id="patientId"
        :newest="index === 0"
        @remove="emit('remove', $event)"
      />
    </div>
  </details>
</template>
