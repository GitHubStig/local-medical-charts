<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { PatientSummary, StartupStatus } from "../../desktop/contract.ts";
import { desktop } from "./desktop.ts";

// Temporary API check page; the real screens replace it from step 6.
const status = ref<StartupStatus | null>(null);
const patients = ref<PatientSummary[]>([]);
const error = ref<string | null>(null);

onMounted(async () => {
  if (!desktop) return;
  try {
    status.value = await desktop.getStartupStatus();
    if (status.value.ok) patients.value = await desktop.listPatients();
  } catch (err) {
    // Binding errors arrive as plain { name, message, stack } objects.
    error.value = (err as { message?: string }).message ?? String(err);
  }
});
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-6 p-10">
    <div class="flex flex-col items-center gap-2">
      <h1 class="text-3xl font-semibold tracking-tight">Medical Charts</h1>
      <p class="text-ink-2">API check</p>
    </div>

    <dl
      v-if="status"
      class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-xl border border-line bg-surface px-5 py-4 text-sm"
    >
      <dt class="text-muted">Database</dt>
      <dd class="font-mono text-xs">{{ status.databasePath }}</dd>
      <template v-if="status.ok">
        <dt class="text-muted">Format</dt>
        <dd>v{{ status.schemaVersion }} · catalog {{ status.catalogHash }}</dd>
        <dt class="text-muted">Launch upgrade</dt>
        <dd>
          {{ status.upgrade.upgraded }} of {{ status.upgrade.checked }} upgraded,
          {{ status.upgrade.failed.length }} failed
        </dd>
        <dt class="text-muted">Patients</dt>
        <dd>{{ patients.length }}</dd>
      </template>
      <template v-else>
        <dt class="text-muted">Error</dt>
        <dd class="text-danger">{{ status.error }}</dd>
      </template>
    </dl>
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>

    <p v-if="!desktop" class="max-w-md text-center text-sm text-ink-2">
      Running in a browser, so there are no desktop bindings. Run
      <code class="font-mono">deno task desktop</code> to open the app in its
      window.
    </p>
  </main>
</template>
