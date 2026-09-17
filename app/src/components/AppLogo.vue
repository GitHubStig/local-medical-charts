<script setup lang="ts">
// desktop/icon.png, the Dock icon, is this logo drawn large: redraw it when this changes.
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 28 28"
    fill="none"
    aria-hidden="true"
  >
    <rect width="28" height="28" rx="7" class="fill-ink" />
    <rect x="5" y="11" width="18" height="7" rx="1.5" class="fill-page opacity-15" />
    <path
      d="M5.5 19.5l5-6 4 3.5 7.5-9"
      class="stroke-page"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
