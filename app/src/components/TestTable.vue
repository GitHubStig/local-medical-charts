<script setup lang="ts">
import { FLAGS } from "../lib/flags.ts";
import type { TestTable } from "../lib/test-table.ts";
import FlagPill from "./FlagPill.vue";

defineProps<{ table: TestTable }>();
const emit = defineEmits<{ open: [key: string] }>();
</script>

<template>
  <!--
    Scrolls sideways once there are more reports than fit; the test names stay in view.
    Each cell's hover text gives that report's own lab range, which can change between labs.
  -->
  <div class="overflow-x-auto rounded-lg border border-line">
    <table class="w-full border-collapse text-left text-sm">
      <thead>
        <tr class="border-b border-line text-xs whitespace-nowrap text-muted">
          <th scope="col" class="sticky left-0 z-10 bg-surface px-4 py-2.5 align-bottom font-semibold text-ink-2">
            Test
          </th>
          <th
            v-for="column in table.columns"
            :key="column.reportId"
            scope="col"
            class="px-4 py-2.5 text-right align-bottom font-medium"
          >
            <span class="flex flex-col items-end gap-0.5">
              <span class="font-semibold text-ink-2">{{ column.date }}</span>
              <span>{{ column.lab }}</span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody v-for="group in table.groups" :key="group.name">
        <tr class="border-b border-line bg-page">
          <th
            scope="colgroup"
            :colspan="table.columns.length + 1"
            class="px-4 py-2 text-xs font-semibold text-ink-2"
          >
            {{ group.name }}
          </th>
        </tr>
        <!-- The whole row opens the large chart; the name is a button, so it works from the keyboard too. -->
        <tr
          v-for="row in group.rows"
          :key="row.key"
          class="group/row cursor-pointer border-b border-hairline"
          @click="emit('open', row.key)"
        >
          <th
            scope="row"
            class="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-medium whitespace-nowrap group-hover/row:bg-page"
          >
            <button type="button" class="text-left underline-offset-2 group-hover/row:underline">
              {{ row.name }}
            </button>
            <span v-if="row.unit" class="block text-xs font-normal text-muted">{{ row.unit }}</span>
          </th>
          <td
            v-for="(cell, index) in row.cells"
            :key="table.columns[index].reportId"
            :title="cell ? (cell.range ? `Lab range ${cell.range}` : 'No lab range printed') : undefined"
            class="px-4 py-2.5 text-right whitespace-nowrap tabular-nums"
            :class="cell?.flag ? 'bg-flag' : 'group-hover/row:bg-page'"
          >
            <span v-if="cell" class="inline-flex items-center justify-end gap-2">
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
</template>
