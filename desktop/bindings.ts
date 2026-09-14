/**
 * The binding handlers, separate from the window so they can be tested
 * directly against an in-memory store. desktop/main.ts binds each one.
 */
import type { CatalogIndex } from "../src/catalog.ts";
import type {
  DesktopBindings,
  ImportFile,
  ImportOutcome,
  StartupStatus,
} from "./contract.ts";
import type { OllamaService } from "./ocr/ollama.ts";
import { withoutPages } from "./report-data.ts";
import { DEFAULT_SETTINGS, parseSettingsPatch } from "./settings.ts";
import { type ReportStore, StoreError } from "./store/store.ts";

export class BindingError extends Error {
  override name = "BindingError";
}

function requireId(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new BindingError(`${label} must be a positive integer`);
  }
  return value;
}

function requireFiles(value: unknown): ImportFile[] {
  const valid = Array.isArray(value) &&
    value.every((f) =>
      f !== null && typeof f === "object" &&
      typeof (f as ImportFile).name === "string" &&
      typeof (f as ImportFile).text === "string"
    );
  if (!valid) {
    throw new BindingError("files must be a list of { name, text }");
  }
  return value as ImportFile[];
}

/**
 * Runs a handler body so that a synchronous throw becomes a rejected Promise,
 * keeping every binding promise-based whether it fails early or late.
 */
function settle<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

export function createBindings(deps: {
  store: ReportStore;
  catalog: CatalogIndex;
  startup: StartupStatus;
  /** Talks to Ollama; tests pass a stand-in. */
  ollama: OllamaService;
  now?: () => Date;
}): DesktopBindings {
  const { store, catalog, startup, ollama } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    getStartupStatus: () => settle(() => startup),

    listPatients: () => settle(() => store.listPatients()),

    getDashboard: (patientId) =>
      settle(() => {
        const id = requireId(patientId, "patientId");
        const patient = store.listPatients().find((p) => p.id === id);
        if (!patient) return null;
        const reports = store.listReports(id).map((summary) => {
          const report = store.getReport(summary.id);
          return { ...summary, report: report ? withoutPages(report) : null };
        });
        return { patient, reports, results: store.resultsForPatient(id) };
      }),

    importReports: (files) =>
      settle(() =>
        requireFiles(files).map((file): ImportOutcome => {
          try {
            return {
              fileName: file.name,
              ...store.addReport(file.text, file.name, catalog, now()),
            };
          } catch (err) {
            // Expected problems with a file become an outcome; anything else is a bug and rejects.
            if (err instanceof StoreError) {
              return {
                fileName: file.name,
                status: "rejected",
                error: err.message,
              };
            }
            throw err;
          }
        })
      ),

    deleteReport: (reportId) =>
      settle(() => store.deleteReport(requireId(reportId, "reportId"), now())),

    clearAll: () => settle(() => store.clearAll()),

    getSettings: () => settle(() => store.getSettings()),

    updateSettings: (patch) =>
      settle(() => store.updateSettings(parseSettingsPatch(patch), now())),

    listOcrModels: () =>
      settle(() => store.getSettings()).then((s) =>
        ollama.listModels(s.ollamaHost)
      ),

    testOcr: () =>
      settle(() => store.getSettings()).then((s) =>
        ollama.test(s.ollamaHost, s.ocrModel)
      ),
  };
}

/** Bindings for when the database couldn't be opened: status explains why, the rest reject. */
export function unavailableBindings(
  startup: Extract<StartupStatus, { ok: false }>,
): DesktopBindings {
  const fail = () =>
    Promise.reject(
      new BindingError(`the database is unavailable: ${startup.error}`),
    );
  return {
    getStartupStatus: () => Promise.resolve(startup),
    listPatients: fail,
    getDashboard: fail,
    importReports: fail,
    deleteReport: fail,
    clearAll: fail,
    // Defaults still apply, so the window can follow the system theme while explaining the error.
    getSettings: () => Promise.resolve(DEFAULT_SETTINGS),
    updateSettings: fail,
    listOcrModels: fail,
    testOcr: fail,
  };
}
