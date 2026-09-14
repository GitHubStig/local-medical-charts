/**
 * PDFs and photos being read into reports: the imports the panel lists, photos
 * waiting for their order to be confirmed, and problems worth showing. Checks
 * on reading every second while anything is still to be read.
 */
import { useIntervalFn } from "@vueuse/core";
import { computed, readonly, ref, shallowRef, watch } from "vue";
import type { DesktopBindings, ImportJob } from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";
import { isActive } from "../lib/import-jobs.ts";
import {
  photoGroups,
  planUploads,
  readUpload,
  type RefusedFile,
} from "../lib/uploads.ts";
import { useOcrSettings } from "./useOcrSettings.ts";

const jobs = shallowRef<ImportJob[]>([]);
const refused = shallowRef<RefusedFile[]>([]);
/** Photos picked or dropped together, until their order is confirmed or they're put away. */
const pendingPhotos = shallowRef<File[] | null>(null);
/** PDFs or photos were added before a model was chosen in Settings. */
const needsModel = ref(false);
const starting = ref(false);
const error = ref<string | null>(null);

let bindings: DesktopBindings | null = null;
let importJson: (files: readonly File[]) => Promise<unknown> = () =>
  Promise.resolve();

const active = computed(() => jobs.value.some(isActive));

async function refresh() {
  if (!bindings) return;
  try {
    jobs.value = await bindings.listImports();
  } catch (err) {
    error.value = errorMessage(err);
  }
}

const polling = useIntervalFn(refresh, 1000, { immediate: false });
watch(active, (reading) => reading ? polling.resume() : polling.pause());

/** Call once the bindings are connected. Report JSON still goes through the library's import. */
export function initImports(
  connected: DesktopBindings,
  options: { importJson: (files: readonly File[]) => Promise<unknown> },
): void {
  bindings = connected;
  importJson = options.importJson;
  refresh();
}

function connected(): DesktopBindings {
  if (!bindings) throw new Error("not connected");
  return bindings;
}

/** Sends each group of files as one report to read. */
async function start(groups: File[][]) {
  if (groups.length === 0) return;
  starting.value = true;
  try {
    const uploads = await Promise.all(
      groups.map(async (files) => ({
        files: await Promise.all(files.map(readUpload)),
      })),
    );
    const outcomes = await connected().startImports(uploads);
    const notRead = outcomes.flatMap((o) =>
      o.ok ? [] : [{ fileName: o.fileNames.join(", "), error: o.error }]
    );
    if (notRead.length) refused.value = [...refused.value, ...notRead];
    await refresh();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    starting.value = false;
  }
}

async function run(action: () => Promise<unknown>) {
  error.value = null;
  try {
    await action();
  } catch (err) {
    error.value = errorMessage(err);
  }
  await refresh();
}

export function useImports() {
  const { model } = useOcrSettings();

  return {
    jobs,
    refused,
    pendingPhotos,
    needsModel: readonly(needsModel),
    starting: readonly(starting),
    error: readonly(error),

    /**
     * Picked or dropped files: report JSON is imported straight away, each PDF
     * starts reading, and photos wait for their order to be confirmed.
     */
    async addFiles(files: readonly File[]) {
      const plan = planUploads(files);
      refused.value = plan.refused;
      needsModel.value = false;
      error.value = null;

      if (plan.json.length) await importJson(plan.json);
      if (plan.pdfs.length || plan.photos.length) {
        if (!model.value) {
          needsModel.value = true;
          return;
        }
        await start(plan.pdfs.map((pdf) => [pdf]));
        if (plan.photos.length) pendingPhotos.value = plan.photos;
      }
    },

    confirmPhotos(ordered: File[], separate: boolean) {
      pendingPhotos.value = null;
      return start(photoGroups(ordered, separate));
    },

    cancelPhotos() {
      pendingPhotos.value = null;
    },

    cancel: (id: number) => run(() => connected().cancelImport(id)),
    retry: (id: number) => run(() => connected().retryImport(id)),
    remove: (id: number) => run(() => connected().discardImport(id)),

    /** Stops and forgets every import still waiting or reading. */
    cancelAll: () =>
      run(() =>
        Promise.all(
          jobs.value.filter(isActive).map((job) =>
            connected().discardImport(job.id)
          ),
        )
      ),

    dismissNotices() {
      refused.value = [];
      needsModel.value = false;
      error.value = null;
    },
  };
}
