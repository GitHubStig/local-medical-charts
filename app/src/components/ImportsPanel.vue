<script setup lang="ts">
import { useNow } from "@vueuse/core";
import { computed } from "vue";
import { useImports } from "../composables/useImports.ts";
import { useOcrSettings } from "../composables/useOcrSettings.ts";
import { plural } from "../lib/format.ts";
import {
  isActive,
  jobKind,
  jobStatus,
  panelHeading,
} from "../lib/import-jobs.ts";
import Icon from "./Icon.vue";

// PDFs and photos being read, as in the "Reading reports" design, plus any
// files that couldn't be read. Shows nothing when there's nothing to say.
const {
  jobs,
  refused,
  needsModel,
  error,
  cancel,
  retry,
  remove,
  cancelAll,
  dismissNotices,
} = useImports();
const { model } = useOcrSettings();
const now = useNow({ interval: 1000 });

const activeCount = computed(() => jobs.value.filter(isActive).length);
const readingModel = computed(() =>
  jobs.value.find((j) => j.status === "reading")?.model ?? model.value
);
const statuses = computed(() =>
  new Map(jobs.value.map((job) => [job.id, jobStatus(job, now.value)]))
);
const hasNotices = computed(() =>
  refused.value.length > 0 || needsModel.value || !!error.value
);

function confirmCancelAll() {
  const count = plural(activeCount.value, "report");
  if (confirm(`Stop reading ${count}? To read them later, add the files again.`)) {
    cancelAll();
  }
}

const quiet =
  "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-ink-2 hover:bg-chip hover:text-ink";
</script>

<template>
  <section
    v-if="jobs.length || hasNotices"
    aria-label="Reading reports"
    class="@container flex w-full flex-col gap-1.5 rounded-xl border border-line bg-surface px-4 pt-4 pb-2 text-left sm:px-6 sm:pt-5"
  >
    <div v-if="jobs.length" class="flex items-start justify-between gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-[15px] font-semibold" aria-live="polite">{{ panelHeading(jobs) }}</h2>
        <p v-if="activeCount" class="text-sm text-ink-2">
          Reading a page at a time<template v-if="readingModel">
            with <span class="font-mono text-[13px] wrap-break-word">{{ readingModel }}</span></template>.
          Keep using the app meanwhile. Nothing is saved until you review it.
        </p>
        <p v-else class="text-sm text-ink-2">Nothing is saved until you review it.</p>
      </div>
      <button v-if="activeCount" type="button" :class="quiet" @click="confirmCancelAll">
        Cancel all
      </button>
    </div>

    <div
      v-if="hasNotices"
      role="alert"
      class="flex items-start justify-between gap-4 py-2"
    >
      <ul class="flex min-w-0 flex-col gap-2 text-sm">
        <li v-if="needsModel" class="flex gap-2.5">
          <Icon name="alert-circle" class="mt-0.5 shrink-0 text-danger" />
          <span>
            Choose a model for reading PDFs and photos in
            <a href="#/settings" class="font-medium text-series hover:underline">Settings</a>,
            then add them again.
          </span>
        </li>
        <li v-for="item in refused" :key="item.fileName + item.error" class="flex gap-2.5">
          <Icon name="alert-circle" class="mt-0.5 shrink-0 text-danger" />
          <span class="wrap-break-word text-danger">{{ item.error }}</span>
        </li>
        <li v-if="error" class="flex gap-2.5">
          <Icon name="alert-circle" class="mt-0.5 shrink-0 text-danger" />
          <span class="wrap-break-word text-danger">{{ error }}</span>
        </li>
      </ul>
      <button
        type="button"
        aria-label="Dismiss"
        class="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:text-ink"
        @click="dismissNotices"
      >
        <Icon name="close" />
      </button>
    </div>

    <!--
      Laid out by the panel's own width: in a narrow panel (the welcome screen, a
      phone) name and actions share the first line with the status below; a wide
      panel keeps the design's three columns, fixed so rows line up.
    -->
    <ul v-if="jobs.length" class="flex flex-col">
      <li
        v-for="(job, index) in jobs"
        :key="job.id"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-2.5 @3xl:min-h-17 @3xl:grid-cols-[minmax(0,1fr)_320px_180px] @3xl:gap-x-6"
        :class="index < jobs.length - 1 ? 'border-b border-hairline' : ''"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chip text-ink-2">
            <Icon :name="job.source === 'pdf' ? 'file-text' : 'image'" :size="20" />
          </span>
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate text-sm font-medium" :title="job.fileNames.join(', ')">
              {{ job.fileNames.join(", ") }}
            </span>
            <span class="text-xs text-muted">{{ jobKind(job) }}</span>
          </span>
        </div>

        <div
          v-for="status in [statuses.get(job.id)!]"
          :key="status.tone"
          class="order-last col-span-2 flex min-w-0 flex-col gap-2 text-[13px] @3xl:order-0 @3xl:col-span-1"
        >
          <template v-if="status.tone === 'reading'">
            <span class="flex justify-between gap-3">
              <span>{{ status.text }}</span>
              <span class="text-muted tabular-nums">{{ status.elapsed }}</span>
            </span>
            <span
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="Math.round((status.progress ?? 0) * 100)"
              :aria-label="`Reading ${job.fileNames.join(', ')}`"
              class="block h-1.5 w-full overflow-hidden rounded-full bg-chip"
            >
              <span
                class="block h-full rounded-full bg-series transition-[width] duration-500"
                :style="{ width: `${(status.progress ?? 0) * 100}%` }"
              ></span>
            </span>
          </template>
          <span v-else-if="status.tone === 'done'" class="flex items-center gap-2">
            <Icon name="check" class="shrink-0" />{{ status.text }}
          </span>
          <span v-else-if="status.tone === 'problem'" class="flex gap-2 text-danger">
            <Icon name="alert-circle" class="mt-0.5 shrink-0" />
            <span class="wrap-break-word">{{ status.text }}</span>
          </span>
          <span v-else class="text-muted">{{ status.text }}</span>
        </div>

        <div class="flex flex-wrap justify-end gap-1">
          <button
            v-if="job.status === 'reading'"
            type="button"
            :class="quiet"
            :aria-label="`Cancel reading ${job.fileNames.join(', ')}`"
            @click="cancel(job.id)"
          >
            Cancel
          </button>
          <!-- The review screen comes next; the link is ready for it. -->
          <a
            v-else-if="job.status === 'ready'"
            :href="`#/review/${job.id}`"
            class="flex h-11 items-center rounded-lg bg-ink px-4.5 text-sm font-medium whitespace-nowrap text-page"
            :aria-label="`Review ${job.fileNames.join(', ')}`"
          >
            Review
          </a>
          <template v-else>
            <button
              v-if="job.status !== 'waiting'"
              type="button"
              :class="quiet"
              :aria-label="`Try reading ${job.fileNames.join(', ')} again`"
              @click="retry(job.id)"
            >
              Retry
            </button>
            <button
              type="button"
              :class="quiet"
              :aria-label="`Remove ${job.fileNames.join(', ')}`"
              @click="remove(job.id)"
            >
              Remove
            </button>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>
