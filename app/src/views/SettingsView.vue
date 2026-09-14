<script setup lang="ts">
import DataSettings from "../components/DataSettings.vue";
import Icon from "../components/Icon.vue";
import NotificationSettings from "../components/NotificationSettings.vue";
import OcrSettings from "../components/OcrSettings.vue";
import TopBar from "../components/TopBar.vue";
import { useLibrary } from "../composables/useLibrary.ts";

const { patients } = useLibrary();
</script>

<template>
  <div class="min-h-screen">
    <TopBar active="settings" />

    <main class="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-6 pb-14 sm:px-10">
      <div class="flex flex-col gap-2">
        <a
          href="#/"
          class="flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-ink-2 hover:text-ink"
        >
          <Icon name="chevron-left" />
          {{ patients.length ? "Back to dashboard" : "Back" }}
        </a>
        <h1 class="text-[28px] font-semibold tracking-tight">Settings</h1>
      </div>
      <OcrSettings class="max-w-[880px]" />
      <NotificationSettings class="max-w-[880px]" />
      <DataSettings class="max-w-[880px]" />
    </main>
  </div>
</template>
