<script setup lang="ts">
import { computed } from "vue";
import type { ImportOutcome } from "../../../desktop/contract.ts";
import { describeImport, summarizeImport } from "../lib/import-files.ts";
import Icon from "./Icon.vue";

const props = defineProps<{ outcomes: readonly ImportOutcome[] }>();

const summary = computed(() => summarizeImport(props.outcomes));
/** Only files that need attention; files added cleanly are covered by the summary. */
const notable = computed(() =>
  props.outcomes.filter((o) => o.status === "rejected" || o.warnings.length > 0)
);
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <p class="font-medium text-ink">{{ describeImport(summary) }}</p>
    <ul v-if="notable.length" class="flex flex-col gap-2.5">
      <li v-for="outcome in notable" :key="outcome.fileName" class="flex gap-2.5">
        <Icon
          name="alert-circle"
          class="mt-0.5 shrink-0"
          :class="outcome.status === 'rejected' ? 'text-danger' : 'text-ink-2'"
        />
        <div class="flex min-w-0 flex-col gap-0.5">
          <span v-if="outcome.status === 'rejected'" class="break-words text-danger">
            {{ outcome.error }}
          </span>
          <span v-else class="font-medium break-words text-ink">{{ outcome.fileName }}</span>
          <span
            v-for="warning in outcome.status === 'rejected' ? [] : outcome.warnings"
            :key="warning"
            class="text-ink-2"
          >
            {{ warning }}
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>
