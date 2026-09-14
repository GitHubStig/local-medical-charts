<script setup lang="ts">
import { computed, ref } from "vue";
import type { Dashboard } from "../../../desktop/contract.ts";
import { plural } from "../lib/format.ts";
import { buildSeries } from "../lib/series.ts";
import { testDetail } from "../lib/test-detail.ts";
import { buildTestGrid, filterTestGrid } from "../lib/test-grid.ts";
import { buildTextResults, filterTextRows } from "../lib/text-results.ts";
import { useTestFilters } from "../composables/useTestFilters.ts";
import TestCard from "./TestCard.vue";
import TestDetail from "./TestDetail.vue";
import TextResults from "./TextResults.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ dashboard: Dashboard }>();

// Kept while switching patients, so a filter stays on as you compare people.
const { query, flaggedOnly, clear } = useTestFilters();

const grid = computed(() => buildTestGrid(props.dashboard));
const series = computed(() => buildSeries(props.dashboard));
const shown = computed(() =>
  filterTestGrid(grid.value.groups, {
    query: query.value,
    flaggedOnly: flaggedOnly.value,
  })
);
const text = computed(() => buildTextResults(props.dashboard));
const shownRows = computed(() =>
  filterTextRows(text.value.rows, {
    query: query.value,
    flaggedOnly: flaggedOnly.value,
  })
);
// The test shown in the zoomed view, by its card's key.
const openKey = ref<string | null>(null);
const openSeries = computed(() =>
  openKey.value ? series.value.get(openKey.value) ?? null : null
);
const openDetail = computed(() =>
  openSeries.value ? testDetail(openSeries.value, props.dashboard.reports) : null
);

const totalCards = computed(() =>
  grid.value.groups.reduce((n, g) => n + g.cards.length, 0)
);
</script>

<template>
  <section aria-labelledby="test-results-heading" class="flex flex-col gap-7">
    <h2 id="test-results-heading" class="sr-only">Test results</h2>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <label
          class="flex h-11 w-80 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 focus-within:border-line-strong"
        >
          <Icon name="search" class="shrink-0 text-muted" />
          <span class="sr-only">Search tests</span>
          <input
            v-model="query"
            type="search"
            placeholder="Search tests"
            class="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </label>
        <button
          type="button"
          role="switch"
          :aria-checked="flaggedOnly"
          class="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 text-sm"
          @click="flaggedOnly = !flaggedOnly"
        >
          <span
            class="flex h-5 w-8.5 items-center rounded-full p-0.5 transition-colors"
            :class="flaggedOnly ? 'bg-ink' : 'bg-line-strong'"
            aria-hidden="true"
          >
            <span
              class="size-4 rounded-full bg-surface shadow-sm transition-transform"
              :class="flaggedOnly ? 'translate-x-3.5' : ''"
            ></span>
          </span>
          Flagged only
        </button>
      </div>
      <span class="text-[13px] text-muted">
        {{ plural(totalCards, "test") }}<template v-if="grid.textOnlyCount">
          · {{ plural(grid.textOnlyCount, "text result") }}</template>
      </span>
    </div>

    <p v-if="shown.length === 0 && shownRows.length === 0" class="flex flex-wrap items-center gap-2 text-sm text-ink-2">
      No tests match{{ query ? ` “${query}”` : "" }}{{ flaggedOnly ? " among flagged results" : "" }}.
      <button
        type="button"
        class="min-h-11 rounded-lg px-2 font-medium text-ink underline underline-offset-2"
        @click="clear"
      >
        Clear filters
      </button>
    </p>

    <section
      v-for="group in shown"
      :key="group.name"
      class="flex flex-col gap-3"
      :aria-label="group.name"
    >
      <div class="flex items-baseline gap-2.5">
        <h3 class="text-[15px] font-semibold">{{ group.name }}</h3>
        <span class="text-xs text-muted">
          {{ plural(group.cards.length, "test") }}<template v-if="group.flagged">
            · {{ group.flagged }} flagged</template>
        </span>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        <TestCard
          v-for="card in group.cards"
          :key="card.key"
          :card="card"
          :series="series.get(card.key)"
          @open="openKey = card.key"
        />
      </div>
    </section>

    <TextResults v-if="shownRows.length" :columns="text.columns" :rows="shownRows" />

    <TestDetail
      v-if="openSeries && openDetail"
      :key="openKey ?? ''"
      :series="openSeries"
      :detail="openDetail"
      @close="openKey = null"
    />
  </section>
</template>
