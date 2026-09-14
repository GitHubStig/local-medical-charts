/**
 * PDFs and photos being read into reports: the imports the panel lists, photos
 * waiting for their order to be confirmed, and problems worth showing. Checks
 * on reading every second while anything is still to be read.
 */
import { useIntervalFn } from "@vueuse/core";
import { computed, readonly, ref, shallowRef, watch } from "vue";
import type { DesktopBindings, ImportJob } from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";
import { plural } from "../lib/format.ts";
import { isActive } from "../lib/import-jobs.ts";
import {
  packUpload,
  photoGroups,
  planUploads,
  type RefusedFile,
} from "../lib/uploads.ts";
import { beginActivity } from "./useActivity.ts";
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

/** Sends each group of files as one report to read, one upload at a time. */
async function start(groups: File[][]) {
  if (groups.length === 0) return;
  starting.value = true;
  const progress = beginActivity(
    `Adding ${plural(groups.length, "report")}`,
    groups.length * 2,
  );
  try {
    for (const group of groups) {
      const { files, bytes } = await packUpload(group);
      progress.step();
      const outcome = await connected().startImport(files, bytes);
      progress.step();
      if (!outcome.ok) {
        refused.value = [
          ...refused.value,
          { fileName: outcome.fileNames.join(", "), error: outcome.error },
        ];
      }
      await refresh();
    }
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    progress.end();
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

    refresh,

    /** A ready import's report and filing, or null once it's gone or isn't ready. */
    loadReview: (id: number) => connected().getImportReview(id),
    loadPage: (id: number, page: number) => connected().getImportPage(id, page),

    /** Saves a reviewed report; the panel no longer lists it unless saving was refused. */
    async save(id: number) {
      const outcome = await connected().saveImport(id);
      await refresh();
      return outcome;
    },

    dismissNotices() {
      refused.value = [];
      needsModel.value = false;
      error.value = null;
    },
  };
}
