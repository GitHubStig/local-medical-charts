<script setup lang="ts">
import { THEMES, type Theme } from "../../../desktop/settings.ts";
import { useTheme } from "../composables/useTheme.ts";

const { theme, setTheme } = useTheme();

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
      class="flex h-[38px] items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors"
      :class="theme === option
        ? 'bg-surface font-semibold text-ink shadow-sm'
        : 'font-medium text-ink-2 hover:text-ink'"
      @click="setTheme(option)"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <template v-if="option === 'system'">
          <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.5" />
          <path d="M5.5 14h5M8 11v3" />
        </template>
        <template v-else-if="option === 'light'">
          <circle cx="8" cy="8" r="3" />
          <path
            d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
          />
        </template>
        <path
          v-else
          d="M13.5 9.6A5.75 5.75 0 016.4 2.5a5.75 5.75 0 107.1 7.1z"
        />
      </svg>
      {{ LABELS[option] }}
    </button>
  </div>
</template>
