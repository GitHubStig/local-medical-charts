/**
 * The app's data as the screens see it: connection, patients, which patient is
 * shown, and the latest import. One shared state for the whole app, started
 * once from App.vue.
 */
import { computed, readonly, ref, shallowRef, watch } from "vue";
import type {
  Dashboard,
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
import { importedPatient, resolveSelection } from "../lib/selection.ts";
import { initChartLibrary } from "./useChartLibrary.ts";
import { initTheme } from "./useTheme.ts";

type Phase = "loading" | "unavailable" | "ready";

const phase = ref<Phase>("loading");
const api = shallowRef<Api | null>(null);
const status = shallowRef<StartupStatus | null>(null);
const patients = shallowRef<PatientSummary[]>([]);
const selectedPatientId = ref<number | null>(null);
/** Everything shown for the selected patient; null while none is selected. */
const dashboard = shallowRef<Dashboard | null>(null);
const lastImport = shallowRef<ImportOutcome[] | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const selectedPatient = computed(() =>
  patients.value.find((p) => p.id === selectedPatientId.value) ?? null
);

function bindings() {
  if (!api.value) throw new Error("not connected");
  return api.value.bindings;
}

async function refreshPatients() {
  patients.value = await bindings().listPatients();
}

let dashboardRequest = 0;

/** Loads the selected patient's dashboard, ignoring answers for a patient no longer selected. */
async function loadDashboard() {
  const id = selectedPatientId.value;
  const request = ++dashboardRequest;
  const loaded = id === null ? null : await bindings().getDashboard(id);
  if (request === dashboardRequest) dashboard.value = loaded;
}

watch(selectedPatientId, () => {
  loadDashboard().catch((err) => {
    error.value = errorMessage(err);
  });
});

/** Shows a patient and remembers the choice for next time. */
function selectPatient(id: number | null) {
  if (selectedPatientId.value === id) return;
  selectedPatientId.value = id;
  bindings().updateSettings({ selectedPatientId: id }).catch((err) => {
    error.value = errorMessage(err);
  });
}

/** Connects, applies saved settings, and loads the patients. Call once. */
export async function startLibrary(): Promise<void> {
  try {
    api.value = await connectApi();
    const settings = await api.value.bindings.getSettings();
    await initTheme(api.value.bindings, settings);
    initChartLibrary(api.value.bindings, settings);
    status.value = await api.value.bindings.getStartupStatus();
    if (!status.value.ok) {
      phase.value = "unavailable";
      return;
    }
    await refreshPatients();
    // A remembered patient who has since been deleted falls back quietly, without
    // overwriting the saved choice until someone picks another patient.
    selectedPatientId.value = resolveSelection(
      patients.value,
      settings.selectedPatientId,
    );
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
    selectedPatientId: readonly(selectedPatientId),
    selectedPatient,
    dashboard,
    lastImport,
    busy: readonly(busy),
    error: readonly(error),

    selectPatient,

    /**
     * Imports picked or dropped files; every file gets one outcome, in picked
     * order. When the new reports all belong to one patient, that patient is shown.
     */
    importFiles: (files: readonly File[]) =>
      withBusy(async () => {
        const prepared = await prepareImport(files);
        const toSend = filesToSend(prepared);
        const sent = toSend.length
          ? await bindings().importReports(toSend)
          : [];
        lastImport.value = mergeOutcomes(prepared, sent);
        await refreshPatients();
        selectPatient(
          resolveSelection(
            patients.value,
            importedPatient(lastImport.value) ?? selectedPatientId.value,
          ),
        );
        // The same patient may have gained reports, which a selection change wouldn't reload.
        await loadDashboard();
        return lastImport.value;
      }),

    /** Removes one report; a patient left with none drops out of the picker. */
    deleteReport: (reportId: number) =>
      withBusy(async () => {
        await bindings().deleteReport(reportId);
        await refreshPatients();
        selectPatient(
          resolveSelection(patients.value, selectedPatientId.value),
        );
        await loadDashboard();
      }),

    clearAll: () =>
      withBusy(async () => {
        await bindings().clearAll();
        lastImport.value = null;
        await refreshPatients();
        selectPatient(null);
      }),

    dismissImport: () => {
      lastImport.value = null;
    },
  };
}
