<script setup lang="ts">
import type { Series } from "../lib/series.ts";
import type { TestCardData } from "../lib/test-grid.ts";
import { plural } from "../lib/format.ts";
import { FLAGS } from "../lib/flags.ts";
import FlagPill from "./FlagPill.vue";
import TestChart from "./TestChart.vue";

defineProps<{ card: TestCardData; series?: Series }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <!-- The whole card opens the zoomed view; the name is the keyboard and screen reader way in. -->
  <article
    class="flex cursor-pointer flex-col gap-2.5 rounded-[10px] border border-line bg-surface p-4 transition-colors hover:border-line-strong"
    :aria-label="card.name"
    @click="emit('open')"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex min-w-0 flex-col gap-0.5">
        <h4 class="truncate text-sm font-semibold">
          <button
            type="button"
            aria-haspopup="dialog"
            class="max-w-full truncate rounded-sm text-left"
          >
            {{ card.name }}
          </button>
        </h4>
        <span class="text-xs text-muted">{{ card.unit ?? "No unit" }}</span>
      </div>
      <FlagPill
        v-if="card.latest.flag"
        :label="FLAGS[card.latest.flag].label"
        :kind="FLAGS[card.latest.flag].kind"
      />
    </div>

    <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span class="text-[26px] leading-none font-semibold">{{ card.latest.display }}</span>
      <span class="text-xs text-ink-2">
        {{ card.change ?? plural(card.readingCount, "result") }}
      </span>
    </div>

    <TestChart v-if="series?.domain" :series="series" class="mt-auto" />

    <div class="flex items-center justify-between gap-3 text-[11px] text-muted" :class="{ 'mt-auto': !series?.domain }">
      <span>{{ card.span }}</span>
      <span v-if="card.range">Lab range {{ card.range }}</span>
      <span v-else-if="series?.bandedRange">Banded range</span>
    </div>
  </article>
</template>
