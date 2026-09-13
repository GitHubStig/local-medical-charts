/**
 * The app's data as the screens see it: connection, patients, and the latest
 * import. One shared state for the whole app, started once from App.vue.
 */
import { computed, readonly, ref, shallowRef } from "vue";
import type {
  ImportOutcome,
  PatientSummary,
  StartupStatus,
} from "../../../desktop/contract.ts";
import { type Api, connectApi, errorMessage } from "../api/index.ts";
import {
  filesToSend,
  mergeOutcomes,
  prepareImport,
} from "../lib/import-files.ts";
import { initTheme } from "./useTheme.ts";

type Phase = "loading" | "unavailable" | "ready";

const phase = ref<Phase>("loading");
const api = shallowRef<Api | null>(null);
const status = shallowRef<StartupStatus | null>(null);
const patients = shallowRef<PatientSummary[]>([]);
const lastImport = shallowRef<ImportOutcome[] | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

function bindings() {
  if (!api.value) throw new Error("not connected");
  return api.value.bindings;
}

async function refreshPatients() {
  patients.value = await bindings().listPatients();
}

/** Connects, applies the saved theme, and loads the patient list. Call once. */
export async function startLibrary(): Promise<void> {
  try {
    api.value = await connectApi();
    await initTheme(api.value.bindings);
    status.value = await api.value.bindings.getStartupStatus();
    if (!status.value.ok) {
      phase.value = "unavailable";
      return;
    }
    await refreshPatients();
    phase.value = "ready";
  } catch (err) {
    error.value = errorMessage(err);
    phase.value = "unavailable";
  }
}

async function withBusy<T>(work: () => Promise<T>): Promise<T | undefined> {
  busy.value = true;
  error.value = null;
  try {
    return await work();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

export function useLibrary() {
  return {
    phase: readonly(phase),
    mode: computed(() => api.value?.mode ?? null),
    status,
    patients,
    lastImport,
    busy: readonly(busy),
    error: readonly(error),

    /** Imports picked or dropped files; every file gets one outcome, in picked order. */
    importFiles: (files: readonly File[]) =>
      withBusy(async () => {
        const prepared = await prepareImport(files);
        const toSend = filesToSend(prepared);
        const sent = toSend.length
          ? await bindings().importReports(toSend)
          : [];
        lastImport.value = mergeOutcomes(prepared, sent);
        await refreshPatients();
        return lastImport.value;
      }),

    clearAll: () =>
      withBusy(async () => {
        await bindings().clearAll();
        lastImport.value = null;
        await refreshPatients();
      }),

    dismissImport: () => {
      lastImport.value = null;
    },
  };
}
