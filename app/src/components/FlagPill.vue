<script setup lang="ts">
/** `kind` picks the icon: an arrow for high or low, a circle otherwise. */
withDefaults(defineProps<{ label: string; kind?: "high" | "low" | "abnormal" }>(), {
  kind: "abnormal",
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-flag py-[3px] pr-2 pl-1.5 text-xs leading-none font-semibold whitespace-nowrap text-flag-ink"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" class="text-critical">
      <path
        v-if="kind === 'high'"
        d="M6 10V2M2.5 5.5L6 2l3.5 3.5"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else-if="kind === 'low'"
        d="M6 2v8M2.5 6.5L6 10l3.5-3.5"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <template v-else>
        <circle cx="6" cy="6" r="4.6" stroke="currentColor" stroke-width="1.4" />
        <path d="M6 3.6v2.8M6 8.3v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </template>
    </svg>
    {{ label }}
  </span>
</template>
