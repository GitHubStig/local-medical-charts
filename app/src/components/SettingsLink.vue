<script setup lang="ts">
import Icon from "./Icon.vue";

/** `active` while on the Settings page itself. */
defineProps<{ active?: boolean }>();
</script>

<template>
  <a
    href="#/settings"
    aria-label="Settings"
    title="Settings"
    :aria-current="active ? 'page' : undefined"
    class="flex size-11 shrink-0 items-center justify-center rounded-lg border transition-colors"
    :class="active ? 'border-line-strong bg-chip text-ink' : 'border-line bg-surface text-ink-2 hover:text-ink'"
  >
    <Icon name="settings" :size="18" />
  </a>
</template>
