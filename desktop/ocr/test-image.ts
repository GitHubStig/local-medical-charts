/**
 * The image Test connection asks a model to read: one fictional lab report line,
 * drawn with mupdf when first needed, so no image file lives in the repo. mupdf
 * is also what turns uploaded PDFs into page images.
 */
import * as mupdf from "mupdf";

export const TEST_IMAGE_QUESTION =
  "What is the potassium result on this page? Reply with the number only.";
export const TEST_IMAGE_ANSWER = "4.7";

/**
 * A one-page PDF with two lines of text. The cross-reference table gets real
 * byte offsets, so mupdf reads it without repairing (and without logging that).
 */
function testPdf(): Uint8Array {
  const text =
    `BT /F1 14 Tf 24 70 Td (NORTHSIDE PATHOLOGY - TEST PAGE) Tj 0 -32 Td (POTASSIUM   ${TEST_IMAGE_ANSWER}   mmol/L   3.5 - 5.1) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 110] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];
  // All ASCII, so string length is byte length.
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

let png: Uint8Array | null = null;

/** The test page as PNG bytes, rendered at twice its size so small text stays sharp. */
export function testImagePng(): Uint8Array {
  if (!png) {
    const doc = mupdf.Document.openDocument(testPdf(), "application/pdf");
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
