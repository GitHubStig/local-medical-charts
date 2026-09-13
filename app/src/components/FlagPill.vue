<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-flag py-[3px] pr-2 pl-1.5 text-xs leading-none font-semibold whitespace-nowrap text-flag-ink"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" class="text-critical">
      <circle cx="6" cy="6" r="4.6" stroke="currentColor" stroke-width="1.4" />
      <path d="M6 3.6v2.8M6 8.3v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    {{ label }}
  </span>
</template>
