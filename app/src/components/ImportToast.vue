<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useLibrary } from "../composables/useLibrary.ts";
import { importToast } from "../lib/import-toast.ts";
import Icon from "./Icon.vue";

// Floats over the bottom-right corner after reports are added, so the page
// underneath never moves. A clean import closes itself after 8 seconds; one
// with a problem or a warning stays until it's closed.
const { lastImport, dismissImport } = useLibrary();

const toast = computed(() =>
  lastImport.value?.length ? importToast(lastImport.value) : null
);

// A new import restarts the card, and with it the countdown.
const showing = ref(0);
watch(lastImport, () => showing.value++);
</script>

<template>
  <div
    aria-live="polite"
    class="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6"
  >
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0 motion-reduce:translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="translate-y-3 opacity-0 motion-reduce:translate-y-0"
    >
      <section
        v-if="toast"
        :key="showing"
        :role="toast.sticky ? 'alert' : 'status'"
        aria-label="Added reports"
        class="group pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgb(28_25_23/0.18)] sm:w-96"
        @keydown.esc="dismissImport"
      >
        <header class="flex items-start gap-3 px-4 pt-3.5 pb-1.5">
          <Icon
            :name="toast.sticky ? 'alert-circle' : 'check'"
            class="mt-0.5 shrink-0"
            :class="toast.sticky ? 'text-danger' : 'text-ink'"
          />
          <h2 class="min-w-0 flex-1 text-sm font-semibold">{{ toast.title }}</h2>
          <button
            type="button"
            aria-label="Close"
            class="-mt-2.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:text-ink"
            @click="dismissImport"
          >
            <Icon name="close" />
          </button>
        </header>

        <ul class="flex max-h-[min(22rem,50vh)] flex-col gap-2.5 overflow-y-auto pr-4 pb-4 pl-11">
          <li v-for="row in toast.rows" :key="row.key" class="flex min-w-0 flex-col gap-0.5 text-[13px]">
            <span class="truncate font-medium" :title="row.fileName">{{ row.fileName }}</span>
            <span :class="row.tone === 'rejected' ? 'wrap-break-word text-danger' : 'text-ink-2'">
              {{ row.detail }}
            </span>
            <span v-for="warning in row.warnings" :key="warning" class="mt-0.5 flex gap-1.5 text-ink-2">
              <Icon name="alert-circle" :size="14" class="mt-0.5 shrink-0 text-danger" />
              <span class="wrap-break-word">{{ warning }}</span>
            </span>
          </li>
        </ul>

        <!-- The countdown to closing; it pauses while the card is pointed at or focused. -->
        <div v-if="!toast.sticky" class="absolute inset-x-0 bottom-0 h-0.5 bg-hairline" aria-hidden="true">
          <div
            class="h-full origin-left bg-series animate-[toast-countdown_8s_linear_forwards] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
            @animationend="dismissImport"
          ></div>
        </div>
      </section>
    </Transition>
  </div>
</template>
