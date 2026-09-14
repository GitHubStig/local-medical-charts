/**
 * The binding handlers, separate from the window so they can be tested
 * directly against an in-memory store. desktop/main.ts binds each one.
 */
import type { CatalogIndex } from "../src/catalog.ts";
import type {
  DesktopBindings,
  ImportFile,
  ImportOutcome,
  ImportUpload,
  StartupStatus,
} from "./contract.ts";
import { ImportError, importMessages } from "./imports/messages.ts";
import { ImportQueue } from "./imports/queue.ts";
import type { PageReader } from "./imports/reader.ts";
import { pagesFromUpload } from "./imports/sources.ts";
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

function requireUploads(value: unknown): ImportUpload[] {
  const valid = Array.isArray(value) &&
    value.every((u) =>
      u !== null && typeof u === "object" &&
      Array.isArray((u as ImportUpload).files) &&
      (u as ImportUpload).files.every((f) =>
        f !== null && typeof f === "object" && typeof f.name === "string" &&
        f.bytes instanceof Uint8Array
      )
    );
  if (!valid) {
    throw new BindingError(
      "uploads must be a list of { files: [{ name, bytes }] }",
    );
  }
  return value as ImportUpload[];
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
  /** Opens a reader for report pages with the saved address and model; tests pass a stand-in. */
  pageReader: (host: string, model: string) => Promise<PageReader>;
  now?: () => Date;
}): DesktopBindings {
  const { store, catalog, startup, ollama, pageReader } = deps;
  const now = deps.now ?? (() => new Date());

  const imports = new ImportQueue({
    pagesFrom: pagesFromUpload,
    // Settings are read as each import starts, so a model chosen meanwhile is used.
    openReader: () =>
      settle(() => store.getSettings()).then((s) => {
        if (!s.ocrModel) throw new ImportError(importMessages.noModel());
        return pageReader(s.ollamaHost, s.ocrModel);
      }),
    catalog,
    now,
  });

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

    clearAll: () =>
      settle(() => {
        store.clearAll();
        imports.clear();
      }),

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

    startImports: (uploads) =>
      settle(() =>
        requireUploads(uploads).map(({ files }) => {
          try {
            return { ok: true as const, job: imports.add(files) };
          } catch (err) {
            if (err instanceof ImportError) {
              return {
                ok: false as const,
                fileNames: files.map((f) => f.name),
                error: err.message,
              };
            }
            throw err;
          }
        })
      ),

    listImports: () => settle(() => imports.list()),

    cancelImport: (importId) =>
      settle(() => imports.cancel(requireId(importId, "importId"))),

    retryImport: (importId) =>
      settle(() => imports.retry(requireId(importId, "importId"))),

    discardImport: (importId) =>
      settle(() => imports.discard(requireId(importId, "importId"))),

    getImportReview: (importId) =>
      settle(() => {
        const review = imports.review(requireId(importId, "importId"));
        return review &&
          { job: review.job, report: withoutPages(review.report) };
      }),

    getImportPage: (importId, page) =>
      settle(() =>
        imports.page(requireId(importId, "importId"), requireId(page, "page"))
      ),

    saveImport: (importId) =>
      settle((): ImportOutcome => {
        const id = requireId(importId, "importId");
        const review = imports.review(id);
        if (!review) {
          throw new BindingError(`import ${id} isn't ready to save`);
        }
        const fileName = review.job.fileNames.join(", ");
        try {
          const saved = store.addReport(
            JSON.stringify(review.report),
            fileName,
            catalog,
            now(),
          );
          imports.discard(id);
          return { fileName, ...saved };
        } catch (err) {
          // Kept, so the person can see why and discard it.
          if (err instanceof StoreError) {
            return { fileName, status: "rejected", error: err.message };
          }
          throw err;
        }
      }),
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
    startImports: fail,
    listImports: fail,
    cancelImport: fail,
    retryImport: fail,
    discardImport: fail,
    getImportReview: fail,
    getImportPage: fail,
    saveImport: fail,
  };
}
