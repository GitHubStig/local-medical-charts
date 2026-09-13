<script setup lang="ts">
import { THEMES, type Theme } from "../../../desktop/settings.ts";
import { useTheme } from "../composables/useTheme.ts";
import type { IconName } from "../icon-names.ts";
import Icon from "./Icon.vue";

/** `compact` shows icons only (names stay available to screen readers and as tooltips). */
defineProps<{ compact?: boolean }>();

const { theme, setTheme } = useTheme();

const ICONS: Record<Theme, IconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};

const LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Colour theme"
    class="flex gap-0.5 rounded-[9px] bg-chip p-[3px]"
  >
    <button
      v-for="option in THEMES"
      :key="option"
      type="button"
      role="radio"
      :aria-checked="theme === option"
      :title="compact ? `${LABELS[option]} theme` : undefined"
      class="flex h-[38px] items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors"
      :class="[
        compact ? 'w-[38px]' : 'px-3',
        theme === option
          ? 'bg-surface font-semibold text-ink shadow-sm'
          : 'font-medium text-ink-2 hover:text-ink',
      ]"
      @click="setTheme(option)"
    >
      <Icon :name="ICONS[option]" :size="15" />
      <span :class="compact ? 'sr-only' : ''">{{ LABELS[option] }}</span>
    </button>
  </div>
</template>
