/**
 * The settings page's Ollama section: the saved address and model, the models
 * Ollama has, and Test connection. Changes save through the settings bindings.
 */
import { computed, readonly, ref, shallowRef } from "vue";
import type {
  DesktopBindings,
  OcrModelList,
  OcrTest,
  Settings,
} from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";

const host = ref("");
const model = ref<string | null>(null);
const models = shallowRef<OcrModelList | null>(null);
const loadingModels = ref(false);
const test = shallowRef<OcrTest | null>(null);
const testing = ref(false);
const saveError = ref<string | null>(null);
let bindings: DesktopBindings | null = null;

/** Call once the bindings are connected, with the settings already loaded. */
export function initOcrSettings(
  connected: DesktopBindings,
  settings: Settings,
): void {
  bindings = connected;
  host.value = settings.ollamaHost;
  model.value = settings.ocrModel;
}

function connected(): DesktopBindings {
  if (!bindings) throw new Error("not connected");
  return bindings;
}

async function refreshModels() {
  loadingModels.value = true;
  try {
    models.value = await connected().listOcrModels();
  } catch (err) {
    models.value = { ok: false, host: host.value, error: errorMessage(err) };
  } finally {
    loadingModels.value = false;
  }
}

async function save(patch: Partial<Settings>): Promise<boolean> {
  saveError.value = null;
  try {
    const saved = await connected().updateSettings(patch);
    host.value = saved.ollamaHost;
    model.value = saved.ocrModel;
    // A result for the old address or model no longer says anything.
    test.value = null;
    return true;
  } catch (err) {
    saveError.value = errorMessage(err);
    return false;
  }
}

export function useOcrSettings() {
  return {
    host: readonly(host),
    model: readonly(model),
    models: computed(() => models.value),
    loadingModels: readonly(loadingModels),
    test: computed(() => test.value),
    testing: readonly(testing),
    saveError: readonly(saveError),
    refreshModels,

    /** Saves a new address and asks it for models. Returns false when the address isn't valid. */
    async setHost(next: string): Promise<boolean> {
      if (next.trim() === host.value) {
        saveError.value = null;
        return true;
      }
      if (!(await save({ ollamaHost: next.trim() }))) {
        saveError.value = "Enter an address like http://localhost:11434";
        return false;
      }
      await refreshModels();
      return true;
    },

    setModel: (next: string | null) => save({ ocrModel: next }),

    async runTest() {
      testing.value = true;
      test.value = null;
      try {
        test.value = await connected().testOcr();
      } catch (err) {
        test.value = {
          host: host.value,
          model: model.value,
          ok: false,
          checks: [{
            step: "reachable",
            ok: false,
            message: errorMessage(err),
          }],
        };
      } finally {
        testing.value = false;
      }
    },
  };
}
