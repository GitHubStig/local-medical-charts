<script setup lang="ts">
import { computed, ref } from "vue";
import type { Dashboard } from "../../../desktop/contract.ts";
import { plural } from "../lib/format.ts";
import { buildSeries } from "../lib/series.ts";
import { testDetail } from "../lib/test-detail.ts";
import {
  buildTestGrid,
  describeFilters,
  filterTestGrid,
} from "../lib/test-grid.ts";
import { buildTextResults, filterTextRows } from "../lib/text-results.ts";
import { useFolds } from "../composables/useFolds.ts";
import { useTestFilters } from "../composables/useTestFilters.ts";
import TestCard from "./TestCard.vue";
import TestDetail from "./TestDetail.vue";
import TestTable from "./TestTable.vue";
import { buildTestTable } from "../lib/test-table.ts";
import TextResults from "./TextResults.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ dashboard: Dashboard }>();

// Kept while switching patients, so a filter stays on as you compare people.
const { query, flaggedOnly, clear } = useTestFilters();
// Whether Tests is open is remembered for each patient.
const { isOpen, setOpen } = useFolds();
const patientId = computed(() => props.dashboard.patient.id);
const testsOpen = computed(() => isOpen(patientId.value, "tests", true));

const grid = computed(() => buildTestGrid(props.dashboard));
const series = computed(() => buildSeries(props.dashboard));
const shown = computed(() =>
  filterTestGrid(grid.value.groups, {
    query: query.value,
    flaggedOnly: flaggedOnly.value,
  })
);
// The table takes the search here and flagged-only itself: it keeps a test
// flagged in any report, where a card only shows the latest result.
const table = computed(() =>
  buildTestTable(
    props.dashboard,
    filterTestGrid(grid.value.groups, { query: query.value, flaggedOnly: false }),
    { flaggedOnly: flaggedOnly.value },
  )
);
const text = computed(() => buildTextResults(props.dashboard));
const shownRows = computed(() =>
  filterTextRows(text.value.rows, {
    query: query.value,
    flaggedOnly: flaggedOnly.value,
  })
);
const filters = computed(() =>
  describeFilters({ query: query.value, flaggedOnly: flaggedOnly.value })
);
// The filter controls live inside Tests, so while it's folded the text results say
// they're filtered, and stay in view even when nothing in them matches.
const textFilteredBy = computed(() => testsOpen.value ? null : filters.value);
const showText = computed(() =>
  text.value.rows.length > 0 &&
  (shownRows.value.length > 0 || textFilteredBy.value !== null)
);
// Cards or a table of every result, remembered for each patient like the folds.
const VIEWS = [
  { value: "cards", label: "Cards" },
  { value: "table", label: "Table" },
] as const;
type TestsView = (typeof VIEWS)[number]["value"];
const view = computed<TestsView>(() =>
  isOpen(patientId.value, "tests:table", false) ? "table" : "cards"
);
const setView = (next: TestsView) =>
  setOpen(patientId.value, "tests:table", next === "table");

// The test shown in the zoomed view, by its card's key.
const openKey = ref<string | null>(null);
const openSeries = computed(() =>
  openKey.value ? series.value.get(openKey.value) ?? null : null
);
const openDetail = computed(() =>
  openSeries.value ? testDetail(openSeries.value, props.dashboard.reports) : null
);
// Left and right in the zoomed view step through the tests as they're shown:
// the current view, search and flagged-only decide which and in what order.
const openOrder = computed(() =>
  (view.value === "table"
    ? table.value.groups.flatMap((g) => g.rows.map((r) => r.key))
    : shown.value.flatMap((g) => g.cards.map((c) => c.key)))
    .filter((key) => series.value.has(key))
);
const openIndex = computed(() =>
  openKey.value ? openOrder.value.indexOf(openKey.value) : -1
);
/** Opens the previous or next test, stopping at either end. */
function step(by: -1 | 1) {
  const next = openOrder.value[openIndex.value + by];
  if (openIndex.value >= 0 && next) openKey.value = next;
}

const totalCards = computed(() =>
  grid.value.groups.reduce((n, g) => n + g.cards.length, 0)
);
const flaggedCards = computed(() =>
  grid.value.groups.reduce((n, g) => n + g.flagged, 0)
);
const summaryNote = computed(() =>
  [
    flaggedCards.value ? `${flaggedCards.value} flagged` : null,
    filters.value ? "Filtered" : null,
  ].filter(Boolean).join(" · ")
);
</script>

<template>
  <div class="flex flex-col gap-7">
    <!-- Folds away, so the text results below are a click away rather than a long scroll. -->
    <details
      :open="testsOpen"
      class="group/tests rounded-xl border border-line bg-surface"
      @toggle="setOpen(patientId, 'tests', ($event.target as HTMLDetailsElement).open)"
    >
      <summary
        class="flex min-h-13 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 [&::-webkit-details-marker]:hidden"
      >
        <span class="flex items-center gap-2.5">
          <Icon name="chevron-down" class="-rotate-90 text-ink-2 transition-transform group-open/tests:rotate-0" />
          <h2 class="text-[15px] font-semibold">Tests</h2>
          <span class="text-[13px] text-muted">{{ totalCards }}</span>
        </span>
        <span class="text-xs text-muted">{{ summaryNote }}</span>
      </summary>

      <div class="flex flex-col gap-7 border-t border-line p-5">
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
            <div role="radiogroup" aria-label="Show tests as" class="flex gap-0.5 rounded-[9px] bg-chip p-0.75">
              <button
                v-for="option in VIEWS"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="view === option.value"
                class="flex h-9.5 items-center rounded-md px-3 text-[13px] whitespace-nowrap transition-colors"
                :class="view === option.value
                  ? 'bg-surface font-semibold text-ink shadow-sm'
                  : 'font-medium text-ink-2 hover:text-ink'"
                @click="setView(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <span class="text-[13px] text-muted">
            {{ plural(totalCards, "test") }}<template v-if="grid.textOnlyCount">
              · {{ plural(grid.textOnlyCount, "text result") }}</template>
          </span>
        </div>

        <p v-if="(view === 'table' ? table.groups.length : shown.length) === 0" class="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <template v-if="filters">
            No tests match{{ query.trim() ? ` “${query.trim()}”` : "" }}{{
              flaggedOnly ? " among flagged results" : ""
            }}.<template v-if="shownRows.length"> Some text results below do.</template>
            <button
              type="button"
              class="min-h-11 rounded-lg px-2 font-medium text-ink underline underline-offset-2"
              @click="clear"
            >
              Clear filters
            </button>
          </template>
          <template v-else>No results with numbers to chart yet.</template>
        </p>

        <TestTable
          v-if="view === 'table' && table.groups.length"
          :table="table"
          @open="openKey = $event"
        />

        <section
          v-for="group in view === 'cards' ? shown : []"
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
      </div>
    </details>

    <TextResults
      v-if="showText"
      :columns="text.columns"
      :rows="shownRows"
      :patient-id="patientId"
      :filtered-by="textFilteredBy"
      @clear="clear"
    />

    <!-- No key: the dialog stays open while stepping, and only its contents change. -->
    <TestDetail
      v-if="openSeries && openDetail"
      :series="openSeries"
      :detail="openDetail"
      :position="openIndex >= 0 ? { index: openIndex, total: openOrder.length } : null"
      @step="step"
      @close="openKey = null"
    />
  </div>
</template>
