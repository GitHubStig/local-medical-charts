<script setup lang="ts">
import Icon from "./Icon.vue";

/** `kind` picks the icon: an arrow for high or low, a circle otherwise. */
withDefaults(
  defineProps<{ label: string; kind?: "high" | "low" | "abnormal" }>(),
  { kind: "abnormal" },
);

const ICON = {
  high: "arrow-up",
  low: "arrow-down",
  abnormal: "alert-circle",
} as const;
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-flag py-0.75 pr-2 pl-1.5 text-xs leading-none font-semibold whitespace-nowrap text-flag-ink"
  >
    <Icon :name="ICON[kind]" :size="12" class="text-critical" />
    {{ label }}
  </span>
</template>
