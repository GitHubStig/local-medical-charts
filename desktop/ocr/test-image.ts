/**
 * The image Test connection asks a model to read: one fictional lab report line,
 * drawn with mupdf when first needed, so no image file lives in the repo. mupdf
 * is also what turns uploaded PDFs into page images.
 */
import * as mupdf from "mupdf";
import { simplePdf } from "./simple-pdf.ts";

export const TEST_IMAGE_QUESTION =
  "What is the potassium result on this page? Reply with the number only.";
export const TEST_IMAGE_ANSWER = "4.7";

let png: Uint8Array | null = null;

/** The test page as PNG bytes, rendered at twice its size so small text stays sharp. */
export function testImagePng(): Uint8Array {
  if (!png) {
    const pdf = simplePdf([[
      "NORTHSIDE PATHOLOGY - TEST PAGE",
      `POTASSIUM   ${TEST_IMAGE_ANSWER}   mmol/L   3.5 - 5.1`,
    ]], { width: 420, height: 110, fontSize: 14, margin: 24, lineHeight: 32 });
    const doc = mupdf.Document.openDocument(pdf, "application/pdf");
    const pixmap = doc.loadPage(0).toPixmap(
      mupdf.Matrix.scale(2, 2),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    png = pixmap.asPNG();
  }
  return png;
}
