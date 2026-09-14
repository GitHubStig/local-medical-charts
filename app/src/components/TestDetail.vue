<script setup lang="ts">
import { computed, onMounted, ref, useId } from "vue";
import { FLAGS } from "../lib/flags.ts";
import type { Series } from "../lib/series.ts";
import type { TestDetail } from "../lib/test-detail.ts";
import ChartLibraryToggle from "./ChartLibraryToggle.vue";
import FlagPill from "./FlagPill.vue";
import Icon from "./Icon.vue";
import TestChart from "./TestChart.vue";

const props = defineProps<{ series: Series; detail: TestDetail }>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();

// Legend entries only for what this chart actually draws.
const hasBounds = computed(() => props.series.points.some((p) => p.op));
const hasFlags = computed(() => props.series.points.some((p) => p.flag));

// A native modal dialog: the page behind becomes inert, focus stays inside,
// Esc closes it, and focus returns to the card afterwards.
onMounted(() => dialog.value?.showModal());

/** Clicks that land on the dialog element itself, not its panel, are on the backdrop. */
function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close();
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="mx-auto mt-16 mb-auto max-h-[calc(100dvh-5rem)] w-[min(72rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[14px] bg-surface text-ink shadow-[0_24px_64px_rgb(28_25_23/0.3)] backdrop:bg-[rgb(28_25_23/0.5)]"
    @click="closeOnBackdrop"
    @close="emit('close')"
  >
    <div class="flex max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto">
      <header class="flex items-start justify-between gap-6 px-8 pt-6 pb-4.5">
        <div class="flex min-w-0 flex-col gap-2">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 :id="titleId" class="text-2xl font-semibold">{{ detail.title }}</h2>
            <span v-if="detail.subtitle" class="text-[15px] text-ink-2">{{ detail.subtitle }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
            <span>{{ detail.meta }}</span>
            <template v-if="detail.latest">
              <span>Latest {{ detail.latest.value }} on {{ detail.latest.date }}</span>
              <FlagPill
                v-if="detail.latest.flag"
                :label="FLAGS[detail.latest.flag].label"
                :kind="FLAGS[detail.latest.flag].kind"
              />
            </template>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2.5">
          <kbd class="rounded-[5px] border border-line px-[7px] py-[3px] font-mono text-xs text-muted">Esc</kbd>
          <button
            type="button"
            autofocus
            aria-label="Close"
            class="flex size-11 items-center justify-center rounded-lg border border-line text-ink-2 hover:text-ink"
            @click="dialog?.close()"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>

      <div class="flex flex-col gap-3.5 px-8 pb-5.5">
        <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <ul class="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-2" aria-label="Legend">
            <li class="flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-series" aria-hidden="true"></span>Result
            </li>
            <li v-if="hasBounds" class="flex items-center gap-2">
              <span class="size-2.5 rounded-full border-2 border-series bg-surface" aria-hidden="true"></span>Reported
              as a bound, e.g. &lt; 5
            </li>
            <li v-if="hasFlags" class="flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-critical" aria-hidden="true"></span>Outside the lab’s range
            </li>
            <li v-if="series.bands.length" class="flex items-center gap-2">
              <span class="h-3 w-5 border-y border-band-edge bg-band" aria-hidden="true"></span>Lab reference range
              — steps where the lab changes
            </li>
            <li v-else-if="series.bandedRange">Banded range: see the table</li>
          </ul>
          <ChartLibraryToggle />
        </div>

        <TestChart v-if="series.domain" :series="series" :height="280" />

        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-line text-xs whitespace-nowrap text-muted">
                <th scope="col" class="px-4 py-2.5 font-medium">Collected</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Lab</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Printed</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Standard</th>
                <th scope="col" class="px-4 py-2.5 font-medium">
                  Lab range{{ series.unit ? ` (${series.unit})` : "" }}
                </th>
                <th scope="col" class="px-4 py-2.5 font-medium">Flag</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Specimen notes</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in detail.rows"
                :key="`${row.reportId}-${row.printedName}`"
                class="border-b border-hairline align-top last:border-b-0"
              >
                <th scope="row" class="px-4 py-3 font-normal whitespace-nowrap">{{ row.date }}</th>
                <td class="px-4 py-3 text-ink-2">{{ row.lab }}</td>
                <td class="px-4 py-3">
                  <span class="whitespace-nowrap">{{ row.printed }}</span>
                  <span class="block text-xs text-muted">as “{{ row.printedName }}”</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">{{ row.standard }}</td>
                <td class="px-4 py-3 text-ink-2">{{ row.range ?? "—" }}</td>
                <td class="px-4 py-3">
                  <FlagPill v-if="row.flag" :label="FLAGS[row.flag].label" :kind="FLAGS[row.flag].kind" />
                  <span v-else-if="row.bound" class="text-muted">{{ row.bound }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="row.specimenNotes.length" class="flex flex-wrap gap-1.5">
                    <span
                      v-for="note in row.specimenNotes"
                      :key="note"
                      class="rounded-full bg-chip px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink-2"
                    >{{ note }}</span>
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="detail.unplotted.length" class="text-[13px] text-ink-2">
          Not on the chart: {{ detail.unplotted.join("; ") }}
        </p>
      </div>

      <footer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-8 py-3.5 text-xs text-muted">
        <span>{{ detail.notes.join(" · ") }}</span>
        <span>Press Esc or click outside to close</span>
      </footer>
    </div>
  </dialog>
</template>
