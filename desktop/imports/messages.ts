/**
 * What an import says when a file can't be read or reading stops. Shared by the
 * desktop import queue and the browser-development fake, so both read the same.
 * No runtime imports.
 */

/** A problem with an upload or with reading it, worded for the person importing. */
export class ImportError extends Error {
  override name = "ImportError";
}

export const importMessages = {
  empty: () => "Nothing to read. Add a PDF or photos of a report.",
  unsupported: (name: string) => `${name} isn't a PDF, JPG, PNG or WebP file.`,
  pdfWithOthers: (name: string) =>
    `${name} is a PDF, so it's read as a report of its own. Add it separately from other files.`,
  notPdf: (name: string) =>
    `${name} couldn't be opened as a PDF. It may be damaged.`,
  passwordProtected: (name: string) =>
    `${name} is password-protected. Save a copy without the password and add that.`,
  noPages: (name: string) => `${name} has no pages.`,
  noModel: () => "Choose a model for reading PDFs and photos in Settings.",
  pageSlow: (model: string, page: number, minutes: number) =>
    `${model} didn't finish reading page ${page} within ${minutes} minutes.`,
  unreadable: (model: string, page: number, attempts: number) =>
    `${model} couldn't give a usable reading of page ${page} after ${attempts} tries.`,
  ollamaError: (detail: string) => `Ollama couldn't read the page. ${detail}`,
  unexpected: (detail: string) => `Reading stopped unexpectedly: ${detail}`,
};
