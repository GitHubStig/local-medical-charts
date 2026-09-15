<script setup lang="ts">
import { computed, onMounted } from "vue";
import AppLogo from "./components/AppLogo.vue";
import ImportToast from "./components/ImportToast.vue";
import PhotoOrderDialog from "./components/PhotoOrderDialog.vue";
import { useImports } from "./composables/useImports.ts";
import { startLibrary, useLibrary } from "./composables/useLibrary.ts";
import { useRoute } from "./composables/useRoute.ts";
import DashboardView from "./views/DashboardView.vue";
import ReviewView from "./views/ReviewView.vue";
import SettingsView from "./views/SettingsView.vue";
import WelcomeView from "./views/WelcomeView.vue";

const { phase, status, patients, error } = useLibrary();
const { route } = useRoute();
const reviewId = computed(() =>
  route.value.name === "review" ? route.value.importId : null
);
const { pendingPhotos, confirmPhotos, cancelPhotos } = useImports();

onMounted(startLibrary);
</script>

<template>
  <div v-if="phase === 'loading'" class="min-h-screen" aria-busy="true"></div>

  <main
    v-else-if="phase === 'unavailable'"
    role="alert"
    class="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center"
  >
    <AppLogo :size="40" />
    <h1 class="text-xl font-semibold">Local Medical Charts can't open its data</h1>
    <p class="text-sm text-ink-2">
      {{ status && !status.ok ? status.error : error }}
    </p>
    <p v-if="status && !status.ok" class="font-mono text-xs text-muted break-all">
      {{ status.databasePath }}
    </p>
  </main>

  <SettingsView v-else-if="route.name === 'settings'" />
  <ReviewView v-else-if="reviewId !== null" :key="reviewId" :import-id="reviewId" />
  <!-- Data already stored goes straight to the dashboard; otherwise, the welcome screen. -->
  <DashboardView v-else-if="patients.length > 0" />
  <WelcomeView v-else />

  <PhotoOrderDialog
    v-if="phase === 'ready' && pendingPhotos"
    :photos="pendingPhotos"
    @confirm="confirmPhotos"
    @cancel="cancelPhotos"
  />
  <ImportToast v-if="phase === 'ready'" />
</template>
