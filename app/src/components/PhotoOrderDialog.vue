<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId } from "vue";
import { plural } from "../lib/format.ts";
import { moveItem } from "../lib/uploads.ts";
import Icon from "./Icon.vue";

// Photos added together are one report by default, one page per photo, in
// file-name order. Before anything is read, the person can fix the order or
// read each photo as a report of its own.
const props = defineProps<{ photos: readonly File[] }>();
const emit = defineEmits<{
  confirm: [ordered: File[], separate: boolean];
  cancel: [];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
// Files stay unwrapped: a reactive proxy can't call their methods.
const order = shallowRef<File[]>([...props.photos]);
const separate = ref(false);

// Thumbnails come straight from the files in memory and are released on close.
const previews = new Map(props.photos.map((f) => [f, URL.createObjectURL(f)]));
onBeforeUnmount(() => previews.forEach((url) => URL.revokeObjectURL(url)));

onMounted(() => dialog.value?.showModal());

let confirmed = false;
function read() {
  confirmed = true;
  emit("confirm", [...order.value], separate.value);
  dialog.value?.close();
}
function onClose() {
  if (!confirmed) emit("cancel");
}

const readLabel = computed(() => {
  const count = order.value.length;
  if (count === 1) return "Read photo";
  return separate.value ? `Read as ${count} reports` : `Read ${count} photos`;
});

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-chip hover:text-ink disabled:pointer-events-none disabled:opacity-35";
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="mx-auto mt-16 mb-auto max-h-[calc(100dvh-5rem)] w-[min(36rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[14px] bg-surface text-ink shadow-[0_24px_64px_rgb(28_25_23/0.3)] backdrop:bg-[rgb(28_25_23/0.5)] dark:border dark:border-line-strong dark:backdrop:bg-black/70"
    @close="onClose"
  >
    <div class="flex max-h-[calc(100dvh-5rem)] flex-col">
      <header class="flex flex-col gap-1 px-6 pt-5 pb-3">
        <h2 :id="titleId" class="text-lg font-semibold">{{ plural(order.length, "photo") }}</h2>
        <p class="text-sm text-ink-2">
          <template v-if="order.length === 1">Read as a one-page report.</template>
          <template v-else-if="separate">Each photo is read as a report of its own.</template>
          <template v-else>
            Read as one report, a page per photo, in this order. Move any that are out of place.
          </template>
        </p>
      </header>

      <ol class="flex min-h-0 flex-col overflow-y-auto border-y border-line px-6" aria-label="Photos in order">
        <li
          v-for="(photo, index) in order"
          :key="previews.get(photo)"
          class="flex items-center gap-3 border-b border-hairline py-2 last:border-b-0"
        >
          <span class="w-5 shrink-0 text-right text-[13px] text-muted tabular-nums">{{ index + 1 }}</span>
          <img
            :src="previews.get(photo)"
            alt=""
            class="size-14 shrink-0 rounded-md border border-line bg-chip object-cover"
          />
          <span class="min-w-0 flex-1 truncate text-sm" :title="photo.name">{{ photo.name }}</span>
          <template v-if="order.length > 1">
            <button
              type="button"
              :class="iconButton"
              :disabled="index === 0"
              :aria-label="`Move ${photo.name} up`"
              @click="order = moveItem(order, index, -1)"
            >
              <Icon name="arrow-up" />
            </button>
            <button
              type="button"
              :class="iconButton"
              :disabled="index === order.length - 1"
              :aria-label="`Move ${photo.name} down`"
              @click="order = moveItem(order, index, 1)"
            >
              <Icon name="arrow-down" />
            </button>
          </template>
        </li>
      </ol>

      <footer class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <label v-if="order.length > 1" class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
          <input v-model="separate" type="checkbox" class="size-4 cursor-pointer accent-ink" />
          Each photo is its own report
        </label>
        <span v-else></span>
        <div class="ml-auto flex gap-2">
          <button
            type="button"
            class="flex h-11 items-center rounded-lg px-4 text-sm font-medium text-ink-2 hover:bg-chip hover:text-ink"
            @click="dialog?.close()"
          >
            Cancel
          </button>
          <button
            type="button"
            autofocus
            class="flex h-11 items-center rounded-lg bg-ink px-4.5 text-sm font-medium whitespace-nowrap text-page"
            @click="read"
          >
            {{ readLabel }}
          </button>
        </div>
      </footer>
    </div>
  </dialog>
</template>
