<script setup lang="ts">
import { computed } from "vue";
import { FLAGS } from "../lib/flags.ts";
import { plural } from "../lib/format.ts";
import type { TextColumn, TextRow } from "../lib/text-results.ts";
import FlagPill from "./FlagPill.vue";
import Icon from "./Icon.vue";

const props = defineProps<{
  columns: readonly TextColumn[];
  rows: readonly TextRow[];
}>();

// "Urinalysis · 6 tests"
const summary = computed(() =>
  [...new Set(props.rows.map((row) => row.group)), plural(props.rows.length, "test")]
    .join(" · ")
);
</script>

<template>
  <details open class="group/text rounded-xl border border-line bg-surface">
    <summary
      class="flex min-h-13 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-5 py-2 [&::-webkit-details-marker]:hidden"
    >
      <span class="flex items-center gap-2.5">
        <Icon name="chevron-down" class="-rotate-90 text-ink-2 transition-transform group-open/text:rotate-0" />
        <h3 class="text-[15px] font-semibold">Text results</h3>
        <span class="text-[13px] text-muted">{{ summary }}</span>
      </span>
      <span class="text-xs text-muted">Results reported as words, not numbers</span>
    </summary>

    <!-- Scrolls sideways once there are more reports than fit. -->
    <div class="overflow-x-auto border-t border-line">
      <table class="w-full border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-line text-xs whitespace-nowrap text-muted">
            <th scope="col" class="px-5 py-2.5 align-bottom font-semibold text-ink-2">Test</th>
            <th scope="col" class="px-5 py-2.5 align-bottom font-semibold text-ink-2">Expected</th>
            <th
              v-for="column in columns"
              :key="column.reportId"
              scope="col"
              class="px-5 py-2.5 align-bottom font-medium"
            >
              <span class="flex flex-col gap-0.5">
                <span class="font-semibold text-ink-2">{{ column.date }}</span>
                <span>{{ column.lab }}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-b border-hairline last:border-b-0">
            <th scope="row" class="px-5 py-3 font-medium whitespace-nowrap">{{ row.name }}</th>
            <td class="px-5 py-3 whitespace-nowrap text-muted">{{ row.expected ?? "—" }}</td>
            <td v-for="(cell, index) in row.cells" :key="columns[index].reportId" class="px-5 py-3">
              <span v-if="cell" class="flex items-center gap-2 whitespace-nowrap">
                {{ cell.text }}
                <FlagPill v-if="cell.flag" :label="FLAGS[cell.flag].label" :kind="FLAGS[cell.flag].kind" />
              </span>
              <span v-else class="text-muted">
                <span aria-hidden="true">—</span>
                <span class="sr-only">Not in this report</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>
