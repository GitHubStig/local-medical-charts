<script setup lang="ts">
import { computed } from "vue";
import type { DashboardReport } from "../../../desktop/contract.ts";
import { reportDetails, reportRow } from "../lib/dashboard.ts";
import { plural } from "../lib/format.ts";
import FlagPill from "./FlagPill.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ entry: DashboardReport; initiallyOpen: boolean }>();
const emit = defineEmits<{ remove: [reportId: number] }>();

const row = computed(() => reportRow(props.entry));
const details = computed(() =>
  props.entry.status === "ok" && props.entry.report
    ? reportDetails(props.entry, props.entry.report)
    : null
);

const blocks = computed(() =>
  details.value
    ? [
      { label: "Provider", lines: details.value.provider, mono: false },
      { label: "Doctor", lines: details.value.doctor, mono: false },
      { label: "Dates", lines: details.value.dates, mono: false },
      { label: "Extracted by", lines: details.value.extraction, mono: true },
    ].filter((b) => b.lines.length)
    : []
);
</script>

<template>
  <details :open="initiallyOpen" class="group/report border-b border-line last:border-b-0">
    <summary
      class="flex min-h-13 cursor-pointer list-none items-center gap-3.5 px-5 py-2 hover:bg-hairline [&::-webkit-details-marker]:hidden"
    >
      <Icon name="chevron-down" class="shrink-0 -rotate-90 text-ink-2 transition-transform group-open/report:rotate-0" />
      <span class="w-28 shrink-0 text-sm font-semibold">{{ row.date }}</span>
      <span class="min-w-0 flex-1 truncate text-sm text-ink-2">{{ row.lab }}</span>
      <span class="hidden gap-2 lg:flex">
        <span
          v-for="note in row.specimenNotes"
          :key="note"
          class="rounded-full bg-chip px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink-2"
        >{{ note }}</span>
      </span>
      <template v-if="row.failed">
        <span class="text-[13px] font-medium text-danger">Couldn't be upgraded</span>
      </template>
      <template v-else>
        <span class="w-22 text-right text-[13px] text-ink-2 tabular-nums">
          {{ plural(row.resultCount, "result") }}
        </span>
        <span class="flex w-26 justify-end">
          <FlagPill v-if="row.flagged" :label="`${row.flagged} flagged`" />
          <span v-else class="text-[13px] text-muted">None flagged</span>
        </span>
      </template>
    </summary>

    <div class="flex flex-col gap-5 pt-2 pr-5 pb-5 pl-[50px]">
      <div v-if="row.failed" class="flex flex-col gap-1 text-sm">
        <p class="text-danger">{{ row.error }}</p>
        <p class="text-ink-2">
          The original upload is kept; it's retried each time the app starts.
        </p>
      </div>

      <template v-if="details">
        <div class="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <div v-for="block in blocks" :key="block.label" class="flex min-w-0 flex-col gap-1">
            <span class="text-xs font-medium text-muted">{{ block.label }}</span>
            <span
              v-for="(line, i) in block.lines"
              :key="i"
              class="break-words"
              :class="i === 0
                ? 'text-sm text-ink'
                : block.mono
                ? 'font-mono text-xs text-ink-2'
                : 'text-[13px] text-ink-2'"
            >{{ line }}</span>
          </div>
        </div>

        <div
          v-if="row.specimenNotes.length || details.referenceNumbers.length"
          class="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <span v-if="row.specimenNotes.length" class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-muted">Specimen</span>
            <span
              v-for="note in row.specimenNotes"
              :key="note"
              class="rounded-full bg-chip px-2.5 py-1 text-xs font-medium text-ink-2"
            >{{ note }}</span>
          </span>
          <span
            v-for="field in details.referenceNumbers"
            :key="field.label"
            class="flex items-center gap-1.5 text-xs"
          >
            <span class="font-medium text-muted">{{ field.label }}</span>
            <span class="font-mono text-ink-2">{{ field.value }}</span>
          </span>
        </div>

        <div
          v-if="details.interpretation.length || details.notes.length"
          class="flex flex-col gap-1"
        >
          <details v-if="details.interpretation.length" class="group/interp">
            <summary
              class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-chip [&::-webkit-details-marker]:hidden"
            >
              <Icon name="chevron-right" class="transition-transform group-open/interp:rotate-90" />
              Interpretation · {{ plural(details.interpretation.length, "note") }}
            </summary>
            <div class="mt-1 flex flex-col gap-3 rounded-lg bg-page px-4 py-3">
              <div v-for="(block, i) in details.interpretation" :key="i" class="flex flex-col gap-0.5">
                <span class="text-xs text-muted">Page {{ block.page }}</span>
                <p v-for="(line, j) in block.lines" :key="j" class="text-[13px] text-ink-2">
                  {{ line }}
                </p>
              </div>
            </div>
          </details>

          <details v-if="details.notes.length" class="group/notes">
            <summary
              class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-chip [&::-webkit-details-marker]:hidden"
            >
              <Icon name="chevron-right" class="transition-transform group-open/notes:rotate-90" />
              Extraction notes · {{ details.notes.length }}
            </summary>
            <ul class="mt-1 flex flex-col gap-1 rounded-lg bg-page px-4 py-3">
              <li v-for="(note, i) in details.notes" :key="i" class="text-[13px] text-ink-2">
                {{ note }}
              </li>
            </ul>
          </details>
        </div>
      </template>

      <div>
        <button
          type="button"
          class="min-h-11 rounded-lg px-2.5 text-[13px] font-medium text-danger hover:bg-chip"
          @click="emit('remove', entry.id)"
        >
          Remove this report
        </button>
      </div>
    </div>
  </details>
</template>
