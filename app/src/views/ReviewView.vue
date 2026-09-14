<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type { ImportReview } from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";
import FlagPill from "../components/FlagPill.vue";
import Icon from "../components/Icon.vue";
import TopBar from "../components/TopBar.vue";
import { useImports } from "../composables/useImports.ts";
import { useLibrary } from "../composables/useLibrary.ts";
import { FLAGS } from "../lib/flags.ts";
import { plural } from "../lib/format.ts";
import {
  extractionNotes,
  filingMessage,
  readingTime,
  reviewDetails,
  reviewRows,
  reviewSummary,
} from "../lib/review.ts";

// A read report beside its pages, checked by a person before anything is saved.
const props = defineProps<{ importId: number }>();

const imports = useImports();
const { patients, mode, showSavedReport } = useLibrary();

const review = shallowRef<ImportReview | null>(null);
const state = ref<"loading" | "ready" | "missing">("loading");
const problem = ref<string | null>(null);
const saving = ref(false);

imports.loadReview(props.importId)
  .then((loaded) => {
    review.value = loaded;
    state.value = loaded ? "ready" : "missing";
  })
  .catch((err) => {
    problem.value = errorMessage(err);
    state.value = "missing";
  });

const rows = computed(() => review.value ? reviewRows(review.value.report) : []);
const notes = computed(() => review.value ? extractionNotes(review.value.report) : []);
const details = computed(() => review.value ? reviewDetails(review.value.report) : []);
const filing = computed(() => review.value ? filingMessage(review.value.filing) : null);
const took = computed(() => review.value ? readingTime(review.value.job) : null);

// ---- pages: fetched as they're shown, kept as object URLs until the screen closes
const pageNumber = ref(1);
const selected = ref<number | null>(null);
const pageUrls = new Map<number, string | null>();
const pageUrl = ref<string | null>(null);
const pageState = ref<"loading" | "shown" | "none">("loading");

watch([pageNumber, review], async ([page, loaded]) => {
  if (!loaded) return;
  if (!pageUrls.has(page)) {
    pageState.value = "loading";
    try {
      const image = await imports.loadPage(props.importId, page);
      pageUrls.set(
        page,
        image
          ? URL.createObjectURL(
            new Blob([image.bytes as Uint8Array<ArrayBuffer>], { type: image.type }),
          )
          : null,
      );
    } catch {
      pageUrls.set(page, null);
    }
  }
  // Another page may have been chosen while this one loaded.
  if (pageNumber.value !== page) return;
  pageUrl.value = pageUrls.get(page) ?? null;
  pageState.value = pageUrl.value ? "shown" : "none";
}, { immediate: true });

onBeforeUnmount(() => {
  for (const url of pageUrls.values()) if (url) URL.revokeObjectURL(url);
});

function select(index: number, page: number) {
  selected.value = index;
  pageNumber.value = page;
}

// ---- saving and discarding
async function save() {
  saving.value = true;
  problem.value = null;
  try {
    const outcome = await imports.save(props.importId);
    if (outcome.status === "rejected") {
      problem.value = outcome.error;
      return;
    }
    location.hash = "#/";
    await showSavedReport(outcome);
  } catch (err) {
    problem.value = errorMessage(err);
  } finally {
    saving.value = false;
  }
}

async function discard() {
  if (!confirm("Discard this report? Nothing from it is saved, and its files are forgotten.")) {
    return;
  }
  await imports.remove(props.importId);
  location.hash = "#/";
}

const FILING_ICON = {
  match: "check",
  new: "plus",
  attention: "alert-circle",
  blocked: "alert-circle",
} as const;
</script>

<template>
  <div class="min-h-screen">
    <TopBar />

    <main class="mx-auto flex max-w-360 flex-col gap-5 px-4 pt-6 pb-14 sm:px-10">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div class="flex min-w-0 flex-col gap-2">
          <a
            href="#/"
            class="flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-ink-2 hover:text-ink"
          >
            <Icon name="chevron-left" />
            {{ patients.length ? "Back to dashboard" : "Back" }}
          </a>
          <h1 class="text-[28px] font-semibold tracking-tight">Review before saving</h1>
          <div v-if="review" class="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
            <span class="break-all">{{ review.job.fileNames.join(", ") }}</span>
            <span>{{ plural(review.job.pageCount, "page") }}</span>
            <span v-if="review.job.model">
              Read by <span class="font-mono text-xs">{{ review.job.model }}</span>
              <template v-if="took"> in {{ took }}</template>
            </span>
          </div>
        </div>
        <div v-if="review" class="flex items-center gap-3">
          <button
            type="button"
            class="flex h-11 items-center rounded-lg border border-danger-line bg-surface px-3.5 text-sm font-medium whitespace-nowrap text-danger hover:bg-chip"
            :disabled="saving"
            @click="discard"
          >
            Discard
          </button>
          <button
            type="button"
            class="flex h-11 items-center rounded-lg bg-ink px-4.5 text-sm font-medium whitespace-nowrap text-page disabled:opacity-60"
            :disabled="saving || !review.filing.patient"
            @click="save"
          >
            {{ saving ? "Saving…" : "Save report" }}
          </button>
        </div>
      </div>

      <p v-if="problem" role="alert" class="flex gap-2 text-sm text-danger">
        <Icon name="alert-circle" class="mt-0.5 shrink-0" />{{ problem }}
      </p>

      <div
        v-if="state === 'missing'"
        class="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-5 py-4 text-sm"
      >
        <p class="font-medium">This report isn't waiting for review any more.</p>
        <p class="text-ink-2">
          Read reports wait here until they're saved or discarded, or the app closes. To read
          it again, add its files again.
        </p>
      </div>

      <template v-else-if="review && filing">
        <div
          class="flex flex-col gap-2 rounded-xl border bg-surface px-5 py-3.5 text-sm"
          :class="filing.tone === 'attention' || filing.tone === 'blocked' ? 'border-danger-line' : 'border-line'"
        >
          <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Icon
              :name="FILING_ICON[filing.tone]"
              class="shrink-0"
              :class="filing.tone === 'attention' || filing.tone === 'blocked' ? 'text-danger' : ''"
            />
            <span>
              {{ filing.before }}<strong v-if="filing.name" class="font-semibold">{{ filing.name }}</strong>{{ filing.after }}
            </span>
            <span class="ml-auto text-[13px] text-muted">{{ reviewSummary(review.report) }}</span>
          </div>
          <ul v-if="filing.notes.length" class="flex flex-col gap-1 pl-6.5 text-[13px] text-ink-2">
            <li v-for="note in filing.notes" :key="note">{{ note }}</li>
          </ul>
        </div>

        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,552px)_minmax(0,1fr)]">
          <section
            aria-label="Report pages"
            class="flex flex-col gap-3.5 rounded-xl bg-chip p-4 lg:sticky lg:top-24"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="text-[13px] font-medium text-ink-2" aria-live="polite">
                Page {{ pageNumber }} of {{ review.job.pageCount }}
              </span>
              <div class="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  class="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
                  :disabled="pageNumber <= 1"
                  @click="pageNumber--"
                >
                  <Icon name="chevron-left" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  class="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
                  :disabled="pageNumber >= review.job.pageCount"
                  @click="pageNumber++"
                >
                  <Icon name="chevron-right" />
                </button>
              </div>
            </div>
            <img
              v-if="pageState === 'shown' && pageUrl"
              :src="pageUrl"
              :alt="`Page ${pageNumber}, as it was read`"
              class="w-full rounded-sm border border-line bg-white shadow-[0_2px_8px_rgb(28_25_23/0.08)]"
            />
            <div
              v-else
              class="flex aspect-[1/1.414] w-full items-center justify-center rounded-sm border border-line bg-surface px-8 text-center text-sm text-muted"
              :aria-busy="pageState === 'loading'"
            >
              <template v-if="pageState === 'none'">
                {{ mode === "fake"
                  ? "Browser development can't draw PDF pages. In the desktop app, the page shows here."
                  : "This page's image couldn't be shown." }}
              </template>
            </div>
          </section>

          <section
            aria-label="Extracted results"
            class="flex min-w-0 flex-col rounded-xl border border-line bg-surface"
          >
            <dl class="grid gap-x-5 gap-y-4 border-b border-line px-5 py-4.5 sm:grid-cols-2 2xl:grid-cols-4">
              <div v-for="item in details" :key="item.label" class="flex min-w-0 flex-col gap-1">
                <dt class="text-xs font-medium text-muted">{{ item.label }}</dt>
                <dd class="text-sm wrap-break-word">{{ item.value }}</dd>
              </div>
            </dl>

            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="border-b border-line text-left text-xs font-medium whitespace-nowrap text-muted">
                    <th class="px-4 py-2.5 font-medium">Test</th>
                    <th class="px-4 py-2.5 font-medium">Result</th>
                    <th class="px-4 py-2.5 font-medium">Lab range</th>
                    <th class="px-4 py-2.5 font-medium">Flag</th>
                    <th class="px-4 py-2.5 font-medium">Catalog</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Choosing a result turns the viewer to its page. -->
                  <tr
                    v-for="row in rows"
                    :key="row.index"
                    class="cursor-pointer border-b border-hairline last:border-b-0"
                    :class="selected === row.index ? 'bg-series-wash' : 'hover:bg-hairline'"
                    @click="select(row.index, row.page)"
                  >
                    <td class="px-4 py-2.5 align-middle">
                      <button
                        type="button"
                        class="flex min-h-11 flex-col justify-center text-left"
                        :aria-pressed="selected === row.index"
                        :aria-label="`${row.name}, page ${row.page}: show the page`"
                      >
                        <span>{{ row.name }}</span>
                        <span class="text-xs text-muted">Page {{ row.page }}</span>
                      </button>
                    </td>
                    <td class="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      <span class="flex items-center gap-2">
                        {{ row.value }}
                        <span v-if="row.unit" class="text-ink-2">{{ row.unit }}</span>
                        <span
                          v-if="row.check"
                          class="rounded-full bg-chip px-2.5 py-1 text-xs font-medium text-ink-2"
                        >Check the page</span>
                      </span>
                    </td>
                    <td class="px-4 py-2.5 whitespace-nowrap text-ink-2">{{ row.range ?? "—" }}</td>
                    <td class="px-4 py-2.5">
                      <FlagPill
                        v-if="row.flag"
                        :label="FLAGS[row.flag].label"
                        :kind="FLAGS[row.flag].kind"
                      />
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td class="px-4 py-2.5">
                      <span v-if="row.catalogName">{{ row.catalogName }}</span>
                      <span v-else class="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                        <Icon name="alert-circle" />Not in the catalog
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p
              v-for="(note, i) in notes"
              :key="i"
              class="flex items-start gap-2.5 border-t border-line px-5 py-3.5 text-[13px] leading-normal text-ink-2"
            >
              <Icon name="alert-circle" class="mt-0.5 shrink-0" />
              <span>
                <span class="font-semibold text-ink">
                  {{ note.page ? `Extraction note, page ${note.page}.` : "Extraction note." }}
                </span>
                {{ note.text }}
              </span>
            </p>
          </section>
        </div>

        <p class="text-xs text-muted">
          Choose a result to see its page. Uploaded files are deleted once the report is saved or
          discarded.
        </p>
      </template>
    </main>
  </div>
</template>
