<script setup lang="ts">
import { computed } from "vue";
import type { ImportOutcome } from "../../../desktop/contract.ts";
import { describeImport, summarizeImport } from "../lib/import-files.ts";

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
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          class="mt-0.5 shrink-0"
          :class="outcome.status === 'rejected' ? 'text-danger' : 'text-ink-2'"
        >
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 4.75v3.75M8 11v.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
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
