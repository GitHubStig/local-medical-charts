/**
 * Turns an upload into page images for the model to read: photos as they are,
 * in the order given, and each page of a PDF either as the scan it already is
 * or rendered with mupdf.
 *
 * File types are recognised by their first bytes, not their names. The uploaded
 * PDF itself isn't kept: once its pages are images, only the images remain.
 */
import * as mupdf from "mupdf";
import { findImages } from "../../src/pdf-images.ts";
import { ImportError, importMessages } from "./messages.ts";

export type ImageType = "image/png" | "image/jpeg" | "image/webp";

/** Where a page image came from: a photo, a PDF page that is one scanned image, or a rendered PDF page. */
export type PageOrigin = "photo" | "scanned" | "rendered";

export type PageImage = {
  name: string;
  type: ImageType;
  bytes: Uint8Array;
  origin: PageOrigin;
};

export type UploadFile = { name: string; bytes: Uint8Array };

export type UploadPages = {
  source: "pdf" | "photos";
  /** Names the report, e.g. "northside-2026-05-11" for northside-2026-05-11.pdf. */
  report: string;
  pages: PageImage[];
};

/** Resolution PDF pages are rendered at: sharp enough for small print, quick to render. */
export const RENDER_DPI = 150;

/** Longest side a scan is kept at: an A4 page at 300 dpi. Larger scans are rendered down to it. */
export const MAX_SCAN_SIDE = 3508;

/** How far a scan may sit from the page edges, as a share of the page's size. */
const EDGE_TOLERANCE = 0.02;

const PDF_MARKER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** What a file is, from its first bytes; null when it's none of the types read. */
export function sniffType(
  bytes: Uint8Array,
): "application/pdf" | ImageType | null {
  const at = (offset: number, signature: number[]) =>
    signature.every((b, i) => bytes[offset + i] === b);

  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }
  // PDF readers accept a little junk before the header, so look a short way in.
  for (let i = 0; i <= Math.min(1024, bytes.length - PDF_MARKER.length); i++) {
    if (at(i, PDF_MARKER)) return "application/pdf";
  }
  return null;
}

const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, "") || name;

export function pagesFromUpload(files: UploadFile[]): UploadPages {
  if (files.length === 0) throw new ImportError(importMessages.empty());

  const typed = files.map((file) => {
    const type = sniffType(file.bytes);
    if (!type) throw new ImportError(importMessages.unsupported(file.name));
    return { ...file, type };
  });

  const pdf = typed.find((f) => f.type === "application/pdf");
  if (pdf) {
    if (typed.length > 1) {
      throw new ImportError(importMessages.pdfWithOthers(pdf.name));
    }
    return {
      source: "pdf",
      report: withoutExtension(pdf.name),
      pages: pdfPages(pdf.name, pdf.bytes),
    };
  }

  return {
    source: "photos",
    report: withoutExtension(typed[0].name),
    pages: typed.map((f) => ({
      name: f.name,
      type: f.type as ImageType,
      bytes: f.bytes,
      origin: "photo",
    })),
  };
}

function pdfPages(name: string, bytes: Uint8Array): PageImage[] {
  // mupdf repairs many broken PDFs, logging as it goes. A repaired file reads
  // fine and one past repair throws, so the log adds nothing: keep it quiet
  // while this (synchronous) work runs.
  mupdf.setLog(() => {});
  try {
    return readPdf(name, bytes);
  } finally {
    mupdf.setLog(null);
  }
}

function readPdf(name: string, bytes: Uint8Array): PageImage[] {
  let doc: mupdf.PDFDocument;
  try {
    doc = mupdf.Document.openDocument(
      bytes,
      "application/pdf",
    ) as mupdf.PDFDocument;
  } catch {
    throw new ImportError(importMessages.notPdf(name));
  }

  try {
    if (doc.needsPassword()) {
      throw new ImportError(importMessages.passwordProtected(name));
    }
    const count = doc.countPages();
    if (count === 0) throw new ImportError(importMessages.noPages(name));

    // Names match `deno task extract`: report-01.png, report-02.jpg, …
    const base = withoutExtension(name);
    const width = String(count).length;
    return Array.from({ length: count }, (_, index): PageImage => {
      const page = doc.loadPage(index) as mupdf.PDFPage;
      try {
        const image = pageImage(doc, page);
        const extension = image.type === "image/jpeg" ? "jpg" : "png";
        return {
          name: `${base}-${
            String(index + 1).padStart(width, "0")
          }.${extension}`,
          ...image,
        };
      } finally {
        page.destroy();
      }
    });
  } catch (err) {
    if (err instanceof ImportError) throw err;
    throw new ImportError(importMessages.notPdf(name), { cause: err });
  } finally {
    doc.destroy();
  }
}

/** A page's image: the scan itself when the page is only a scan, otherwise the page rendered. */
function pageImage(
  doc: mupdf.PDFDocument,
  page: mupdf.PDFPage,
): Omit<PageImage, "name"> {
  const scan = scannedImage(doc, page);
  if (scan && scan !== "too large") return { ...scan, origin: "scanned" };

  // PDF user space is 72 units per inch.
  const [x0, y0, x1, y1] = page.getBounds();
  const scale = scan === "too large"
    ? MAX_SCAN_SIDE / Math.max(x1 - x0, y1 - y0)
    : RENDER_DPI / 72;
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true,
  );
  try {
    return { type: "image/png", bytes: pixmap.asPNG(), origin: "rendered" };
  } finally {
    pixmap.destroy();
  }
}

type Scan = { type: "image/jpeg" | "image/png"; bytes: Uint8Array };

/**
 * The page's own image, when the page draws nothing but one upright image
 * covering it: what scanner apps make, often with an invisible text layer.
 * "too large" for a scan bigger than MAX_SCAN_SIDE; null for any other page.
 */
function scannedImage(
  doc: mupdf.PDFDocument,
  page: mupdf.PDFPage,
): Scan | "too large" | null {
  const drawn = loneImage(page);
  if (!drawn) return null;

  // The drawn image, as an object in the file; an inline image has none, so it's rendered.
  const found = findImages(page.getObject().getInheritable("Resources"))
    .find(({ dict }) =>
      dict.get("Width").asNumber() === drawn.width &&
      dict.get("Height").asNumber() === drawn.height
    );
  if (!found) return null;
  if (Math.max(drawn.width, drawn.height) > MAX_SCAN_SIDE) return "too large";

  const { ref, dict } = found;
  const filter = dict.get("Filter");
  // A plain grey or colour JPEG is already a file Ollama reads: send its bytes untouched.
  const verbatim = filter.isName() && filter.asName() === "DCTDecode" &&
    (drawn.components === 1 || drawn.components === 3) &&
    dict.get("Decode").isNull() && dict.get("SMask").isNull() &&
    dict.get("Mask").isNull();
  if (verbatim) {
    const buffer = ref.readRawStream();
    try {
      return { type: "image/jpeg", bytes: buffer.asUint8Array().slice() };
    } finally {
      buffer.destroy();
    }
  }

  // Anything else (JPEG 2000, fax-style, lossless, CMYK) is decoded once, at its own size.
  const image = doc.loadImage(ref);
  let pixmap = image.toPixmap();
  try {
    const grey = pixmap.getNumberOfComponents() - pixmap.getAlpha() === 1;
    if (pixmap.getAlpha() || ![1, 3].includes(pixmap.getNumberOfComponents())) {
      const converted = pixmap.convertToColorSpace(
        grey ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB,
        false,
      );
      pixmap.destroy();
      pixmap = converted;
    }
    // Grey scans compress well losslessly; colour scans would be several megabytes as PNG.
    return grey
      ? { type: "image/png", bytes: pixmap.asPNG() }
      : { type: "image/jpeg", bytes: pixmap.asJPEG(92, false) };
  } finally {
    pixmap.destroy();
    image.destroy();
  }
}

type DrawnImage = { width: number; height: number; components: number };

/** The one image a page draws, if it draws nothing else visible and the image covers the page upright. */
function loneImage(page: mupdf.PDFPage): DrawnImage | null {
  const bounds = page.getBounds();
  let drawn: DrawnImage | null = null;
  let other = false;
  const drawsSomethingElse = () => {
    other = true;
  };

  // Clips, groups, layers and invisible text draw nothing themselves, so they're ignored.
  const device = new mupdf.Device({
    fillPath: drawsSomethingElse,
    strokePath: drawsSomethingElse,
    fillText: drawsSomethingElse,
    strokeText: drawsSomethingElse,
    fillShade: drawsSomethingElse,
    fillImageMask: drawsSomethingElse,
    beginTile: () => {
      other = true;
      return 0;
    },
    fillImage: (image, ctm, alpha) => {
      if (drawn || alpha < 1 || !coversPage(ctm, bounds)) {
        other = true;
        return;
      }
      drawn = {
        width: image.getWidth(),
        height: image.getHeight(),
        components: image.getNumberOfComponents(),
      };
    },
  });
  try {
    // Annotations and form fields are drawn too, so a stamp counts as something else.
    page.run(device, mupdf.Matrix.identity);
  } finally {
    device.close();
    device.destroy();
  }
  return other ? null : drawn;
}

/**
 * Whether an image placed by this matrix fills the page, upright and not
 * mirrored. A rotated page or scan turns the matrix, so it doesn't count: its
 * pixels would reach the model sideways.
 */
function coversPage(
  [a, b, c, d, e, f]: mupdf.Matrix,
  [x0, y0, x1, y1]: mupdf.Rect,
): boolean {
  const width = x1 - x0, height = y1 - y0;
  const near = (value: number, target: number, size: number) =>
    Math.abs(value - target) <= size * EDGE_TOLERANCE;
  return a > 0 && d > 0 && near(b, 0, height) && near(c, 0, width) &&
    near(a, width, width) && near(d, height, height) &&
    near(e, x0, width) && near(f, y0, height);
}
