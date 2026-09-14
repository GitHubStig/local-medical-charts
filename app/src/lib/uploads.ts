/**
 * Sorting what someone picked or dropped into the ways it's imported: report
 * JSON straight in, each PDF as a report of its own, and photos gathered for the
 * person to put in order first. Files that can't be read are refused here, in
 * words, without a round trip. The desktop side checks the bytes again.
 *
 * Only File and Intl, so Deno tests can cover it.
 */
import { packFiles } from "../../../desktop/imports/packed-files.ts";

/** For the file picker: report JSON, PDFs and the photo types Ollama reads. */
export const ACCEPT = [
  ".json",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  "application/json",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

/** A PDF or photo larger than this is refused before it's read into memory. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export type RefusedFile = { fileName: string; error: string };

export type UploadPlan = {
  json: File[];
  pdfs: File[];
  /** In file-name order, as cameras and scanners number them. */
  photos: File[];
  refused: RefusedFile[];
};

const byFileName = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function kindOf(file: File): "json" | "pdf" | "photo" | "heic" | null {
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() ?? "";
  if (extension === "json" || file.type === "application/json") return "json";
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (
    ["jpg", "jpeg", "png", "webp"].includes(extension) ||
    ["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) return "photo";
  if (
    ["heic", "heif"].includes(extension) || /^image\/hei[cf]$/.test(file.type)
  ) {
    return "heic";
  }
  return null;
}

export function planUploads(files: readonly File[]): UploadPlan {
  const plan: UploadPlan = { json: [], pdfs: [], photos: [], refused: [] };
  for (const file of files) {
    const kind = kindOf(file);
    if (kind === null) {
      plan.refused.push({
        fileName: file.name,
        error:
          `${file.name} isn't a PDF, a photo (JPG, PNG or WebP) or report JSON.`,
      });
    } else if (kind === "heic") {
      plan.refused.push({
        fileName: file.name,
        error:
          `${file.name} is a HEIC photo, which can't be read. Save it as a JPEG and add that.`,
      });
    } else if (kind !== "json" && file.size > MAX_UPLOAD_BYTES) {
      const mb = Math.round(file.size / 1024 / 1024);
      plan.refused.push({
        fileName: file.name,
        error:
          `${file.name} is ${mb} MB, more than the 100 MB that can be read.`,
      });
    } else if (kind === "json") {
      plan.json.push(file);
    } else {
      plan[kind === "pdf" ? "pdfs" : "photos"].push(file);
    }
  }
  plan.photos.sort((a, b) => byFileName.compare(a.name, b.name));
  return plan;
}

/** Confirmed photos as uploads: one report in the order given, or a report per photo. */
export function photoGroups<T>(
  ordered: readonly T[],
  separate: boolean,
): T[][] {
  if (ordered.length === 0) return [];
  return separate ? ordered.map((item) => [item]) : [[...ordered]];
}

/** A copy of the list with one item moved `offset` places, stopping at either end. */
export function moveItem<T>(
  items: readonly T[],
  index: number,
  offset: number,
): T[] {
  const copy = [...items];
  const target = Math.min(Math.max(index + offset, 0), copy.length - 1);
  if (index < 0 || index >= copy.length || target === index) return copy;
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return copy;
}

/** One upload's files as the startImport binding takes them: names and sizes, and the bytes. */
export async function packUpload(files: readonly File[]) {
  return packFiles(
    await Promise.all(files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }))),
  );
}
