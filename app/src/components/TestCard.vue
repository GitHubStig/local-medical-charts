<script setup lang="ts">
import type { TestCardData } from "../lib/test-grid.ts";
import { plural } from "../lib/format.ts";
import { FLAGS } from "../lib/flags.ts";
import FlagPill from "./FlagPill.vue";

defineProps<{ card: TestCardData }>();
</script>

<template>
  <article
    class="flex flex-col gap-2.5 rounded-[10px] border border-line bg-surface p-4"
    :aria-label="card.name"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex min-w-0 flex-col gap-0.5">
        <h4 class="truncate text-sm font-semibold">{{ card.name }}</h4>
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

    <div class="mt-auto flex items-center justify-between gap-3 text-[11px] text-muted">
      <span>{{ card.span }}</span>
      <span v-if="card.range">Lab range {{ card.range }}</span>
    </div>
  </article>
</template>
