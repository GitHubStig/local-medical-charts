<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import type {
  ImportOutcome,
  PatientSummary,
  StartupStatus,
} from "../../desktop/contract.ts";
import { type Api, connectApi, errorMessage } from "./api/index.ts";
import ThemeToggle from "./components/ThemeToggle.vue";
import { initTheme } from "./composables/useTheme.ts";

// Temporary API check page; the real screens replace it from step 6.
const api = shallowRef<Api | null>(null);
const status = ref<StartupStatus | null>(null);
const patients = ref<PatientSummary[]>([]);
const outcomes = ref<ImportOutcome[]>([]);
const error = ref<string | null>(null);

async function refresh() {
  if (!api.value) return;
  status.value = await api.value.bindings.getStartupStatus();
  if (status.value.ok) patients.value = await api.value.bindings.listPatients();
}

async function run(action: () => Promise<void>) {
  error.value = null;
  try {
    await action();
  } catch (err) {
    error.value = errorMessage(err);
  }
}

onMounted(() =>
  run(async () => {
    api.value = await connectApi();
    await initTheme(api.value.bindings);
    await refresh();
  })
);

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  return run(async () => {
    const texts = await Promise.all(
      files.map(async (f) => ({ name: f.name, text: await f.text() })),
    );
    outcomes.value = await api.value!.bindings.importReports(texts);
    await refresh();
  });
}

const clearAll = () =>
  run(async () => {
    await api.value!.bindings.clearAll();
    outcomes.value = [];
    await refresh();
  });
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-10">
    <header class="flex items-center justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight">Medical Charts</h1>
        <p class="text-sm text-ink-2">
          API check<template v-if="api">
            · {{ api.mode === "desktop" ? "desktop bindings" : "fake bindings, sample data" }}</template>
        </p>
      </div>
      <ThemeToggle />
    </header>

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
      </template>
      <template v-else>
        <dt class="text-muted">Error</dt>
        <dd class="text-danger">{{ status.error }}</dd>
      </template>
    </dl>

    <section
      v-if="status?.ok"
      class="flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">Patients ({{ patients.length }})</h2>
        <div class="flex gap-2">
          <label
            class="flex h-11 cursor-pointer items-center rounded-lg bg-ink px-4 font-medium text-page"
          >
            Import reports
            <input
              type="file"
              accept=".json,application/json"
              multiple
              class="sr-only"
              @change="onFiles"
            />
          </label>
          <button
            type="button"
            class="h-11 rounded-lg border border-line px-4 font-medium text-danger"
            @click="clearAll"
          >
            Clear all
          </button>
        </div>
      </div>
      <ul class="flex flex-col gap-1">
        <li v-for="p in patients" :key="p.id" class="flex justify-between gap-4">
          <span>{{ p.name }}</span>
          <span class="text-muted">
            {{ p.reportCount }} report{{ p.reportCount === 1 ? "" : "s" }}
          </span>
        </li>
      </ul>
      <ul v-if="outcomes.length" class="flex flex-col gap-1 border-t border-hairline pt-3">
        <li v-for="o in outcomes" :key="o.fileName" class="flex flex-col">
          <span>{{ o.fileName }}: <strong>{{ o.status }}</strong></span>
          <span v-if="o.status === 'rejected'" class="text-danger">{{ o.error }}</span>
        </li>
      </ul>
    </section>

    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
  </main>
</template>
