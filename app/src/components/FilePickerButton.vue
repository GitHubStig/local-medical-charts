<script setup lang="ts">
import { ref } from "vue";
import { ACCEPT } from "../lib/uploads.ts";

// A button that opens the webview's file picker for reports: PDFs, photos or JSON. The input is a
// real element in the page, which is what Deno Desktop supports for picking files.
defineOptions({ inheritAttrs: false });
defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ files: [files: File[]] }>();

const input = ref<HTMLInputElement | null>(null);

function onChange() {
  const files = [...(input.value?.files ?? [])];
  if (input.value) input.value.value = "";
  if (files.length) emit("files", files);
}
</script>

<template>
  <input
    ref="input"
    type="file"
    :accept="ACCEPT"
    multiple
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="onChange"
  />
  <button type="button" v-bind="$attrs" :disabled="disabled" @click="input?.click()">
    <slot />
  </button>
</template>
