/**
 * Finding the images a PDF page draws from its resources, shared by
 * `deno task extract --embedded` and the desktop app's scanned-page check.
 */
import type * as mupdf from "mupdf";

/**
 * An image XObject, kept as both the indirect reference (the only handle that
 * can read the stream) and the resolved dictionary (the only one that can read
 * the keys).
 */
export type ImageXObject = { ref: mupdf.PDFObject; dict: mupdf.PDFObject };

/** Image XObjects on a page, descending into form XObjects. */
export function findImages(
  resources: mupdf.PDFObject,
  seen = new Set<number>(),
): ImageXObject[] {
  const found: ImageXObject[] = [];
  const xobjects = resources.get("XObject");
  if (!xobjects.isDictionary()) return found;

  xobjects.forEach((ref) => {
    // Guard against a form that references itself, directly or in a cycle.
    const id = ref.asIndirect();
    if (id && seen.has(id)) return;
    if (id) seen.add(id);

    const dict = ref.resolve();
    const subtype = dict.get("Subtype");
    if (!subtype.isName()) return;
    if (subtype.asName() === "Image") {
      found.push({ ref, dict });
    } else if (subtype.asName() === "Form") {
      found.push(...findImages(dict.get("Resources"), seen));
    }
  });
  return found;
}

/**
 * The last filter in an image's chain — the one that determines the stream's
 * encoding. Filter is either a single name or an array applied in order.
 */
export function lastFilter(image: mupdf.PDFObject): string | undefined {
  const filter = image.get("Filter");
  if (filter.isName()) return filter.asName();
  if (filter.isArray() && filter.length > 0) {
    const last = filter.get(filter.length - 1);
    if (last.isName()) return last.asName();
  }
  return undefined;
}
