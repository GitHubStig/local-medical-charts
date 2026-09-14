<script setup lang="ts">
import { ref } from "vue";
import type { PatientOverview } from "../lib/dashboard.ts";
import { maskId } from "../lib/format.ts";
import FlagPill from "./FlagPill.vue";

defineProps<{ overview: PatientOverview }>();

// The ID number stays masked on screen unless someone asks to see it.
const revealed = ref(false);
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div class="flex flex-col gap-2">
      <h1 class="text-[28px] font-semibold tracking-tight">{{ overview.name }}</h1>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <span v-if="overview.sexAndAge">{{ overview.sexAndAge }}</span>
        <span v-if="overview.idNumber" class="flex items-center gap-1.5">
          ID
          <span class="font-mono text-xs">{{ revealed ? overview.idNumber : maskId(overview.idNumber) }}</span>
          <button
            type="button"
            class="min-h-6 rounded px-1 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
            :aria-pressed="revealed"
            :aria-label="revealed ? 'Hide ID number' : 'Show ID number'"
            @click="revealed = !revealed"
          >
            {{ revealed ? "Hide" : "Show" }}
          </button>
        </span>
        <span>{{ overview.reports }}</span>
        <span v-if="overview.labs">{{ overview.labs }}</span>
      </div>
    </div>

    <div v-if="overview.latest" class="flex items-center gap-2.5 text-[13px] text-ink-2">
      <!-- With one report, its date is already in the line on the left. -->
      <span v-if="overview.latest.date && !overview.singleReport">Latest report {{ overview.latest.date }}</span>
      <FlagPill
        v-if="overview.latest.flagged"
        :label="`${overview.latest.flagged} flagged`"
      />
      <span v-else class="text-muted">None flagged</span>
    </div>
  </div>
</template>
