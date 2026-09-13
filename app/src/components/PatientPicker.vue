<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { computed, nextTick, ref, useId } from "vue";
import type { PatientSummary } from "../../../desktop/contract.ts";
import { displayName, initials, monthSpan, plural } from "../lib/format.ts";

const props = defineProps<{
  patients: readonly PatientSummary[];
  selectedId: number | null;
}>();
const emit = defineEmits<{ select: [id: number] }>();

const open = ref(false);
/** Index of the option keyboard focus is on while the list is open. */
const active = ref(0);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const list = ref<HTMLElement | null>(null);
const listId = useId();

const selected = computed(() =>
  props.patients.find((p) => p.id === props.selectedId) ?? null
);

onClickOutside(root, () => close(false));

async function openList() {
  active.value = Math.max(0, props.patients.findIndex((p) => p.id === props.selectedId));
  open.value = true;
  await nextTick();
  list.value?.focus();
}

function close(returnFocus = true) {
  if (!open.value) return;
  open.value = false;
  if (returnFocus) trigger.value?.focus();
}

function choose(index: number) {
  const patient = props.patients[index];
  if (patient) emit("select", patient.id);
  close();
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    openList();
  }
}

function onListKeydown(event: KeyboardEvent) {
  const last = props.patients.length - 1;
  switch (event.key) {
    case "ArrowDown":
      active.value = Math.min(last, active.value + 1);
      break;
    case "ArrowUp":
      active.value = Math.max(0, active.value - 1);
      break;
    case "Home":
      active.value = 0;
      break;
    case "End":
      active.value = last;
      break;
    case "Enter":
    case " ":
      choose(active.value);
      break;
    case "Escape":
      close();
      break;
    case "Tab":
      close(false);
      return;
    default:
      return;
  }
  event.preventDefault();
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      class="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-surface pr-3 pl-1.5 text-left transition-colors hover:border-line-strong"
      @click="open ? close() : openList()"
      @keydown="onTriggerKeydown"
    >
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-ink"
        aria-hidden="true"
      >{{ initials(displayName(selected?.name)) }}</span>
      <span class="flex flex-col leading-tight">
        <span class="text-sm font-semibold text-ink">{{ displayName(selected?.name) }}</span>
        <span class="text-xs text-muted">{{ plural(selected?.reportCount ?? 0, "report") }}</span>
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        class="text-ink-2 transition-transform"
        :class="open ? 'rotate-180' : ''"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <ul
      v-if="open"
      :id="listId"
      ref="list"
      role="listbox"
      tabindex="-1"
      aria-label="Patients"
      :aria-activedescendant="`${listId}-option-${active}`"
      class="absolute top-full left-0 z-20 mt-2 flex max-h-96 w-80 flex-col gap-0.5 overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg focus:outline-none"
      @keydown="onListKeydown"
    >
      <li
        v-for="(patient, index) in patients"
        :id="`${listId}-option-${index}`"
        :key="patient.id"
        role="option"
        :aria-selected="patient.id === selectedId"
        class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2"
        :class="index === active ? 'bg-chip' : ''"
        @click="choose(index)"
        @mousemove="active = index"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-ink"
          aria-hidden="true"
        >{{ initials(displayName(patient.name)) }}</span>
        <span class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="truncate text-sm font-semibold text-ink">{{ displayName(patient.name) }}</span>
          <span class="truncate text-xs text-muted">
            {{ plural(patient.reportCount, "report") }}<template
              v-if="monthSpan(patient.firstCollectedAt, patient.lastCollectedAt)"
            > · {{ monthSpan(patient.firstCollectedAt, patient.lastCollectedAt) }}</template>
          </span>
          <span v-if="patient.failedReportCount" class="text-xs text-danger">
            {{ plural(patient.failedReportCount, "report") }} couldn't be upgraded
          </span>
        </span>
        <svg
          v-if="patient.id === selectedId"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          class="shrink-0 text-ink"
        >
          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </li>
    </ul>
  </div>
</template>
