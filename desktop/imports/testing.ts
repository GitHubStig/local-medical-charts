/**
 * Fictional scanned PDFs for tests: a typed page turned into an image, then
 * placed the way scanner apps place it, or the ways that aren't a plain scan.
 * Every line on the page is made up.
 */
import * as mupdf from "mupdf";
import { simplePdf } from "../ocr/simple-pdf.ts";

const LINES = [
  "NORTHSIDE PATHOLOGY",
  "PATIENT: TAN, ALEX        ID NO: X1234567",
  "HAEMOGLOBIN   12.1   g/dL   11.5 - 16.0",
];

/** The fictional page as a pixmap at the given resolution. Destroy it when done. */
function scanPixmap(dpi: number): mupdf.Pixmap {
  const doc = mupdf.Document.openDocument(
    simplePdf([LINES]),
    "application/pdf",
  );
  const page = doc.loadPage(0);
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(dpi / 72, dpi / 72),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true,
  );
  page.destroy();
  doc.destroy();
  return pixmap;
}

/** The fictional page as a scanner's JPEG. */
export function scanJpeg(dpi = 200): Uint8Array {
  const pixmap = scanPixmap(dpi);
  try {
    return pixmap.asJPEG(85, false);
  } finally {
    pixmap.destroy();
  }
}

export type TestPage =
  | { kind: "typed" }
  | {
    kind: "scan";
    /** JPEG bytes stored as they are, or a lossless (Flate) scan at 200 dpi. */
    image: Uint8Array | "lossless";
    rotate?: 90;
    /** Points of white page around the image. */
    margin?: number;
    /** The invisible text layer searchable scans carry. */
    hiddenText?: boolean;
    /** A stamp annotation on top, which the image doesn't contain. */
    stamp?: boolean;
  };

/** An A4 PDF of the given pages. */
export function testPdf(pages: TestPage[]): Uint8Array {
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font("Courier"));
  for (const spec of pages) {
    let content: string;
    let xobjects = {};
    if (spec.kind === "typed") {
      content = `BT /F1 11 Tf 16 TL 48 783 Td ${
        LINES.map((l) => `(${l}) Tj`).join(" T* ")
      } ET`;
    } else {
      let image: mupdf.Image;
      if (spec.image === "lossless") {
        const pixmap = scanPixmap(200);
        image = new mupdf.Image(pixmap);
        pixmap.destroy();
      } else {
        image = new mupdf.Image(spec.image);
      }
      xobjects = { Im0: doc.addImage(image) };
      const m = spec.margin ?? 0;
      content = `q ${595 - 2 * m} 0 0 ${842 - 2 * m} ${m} ${m} cm /Im0 Do Q`;
      if (spec.hiddenText) {
        content += ` BT 3 Tr /F1 11 Tf 48 783 Td (${LINES[2]}) Tj ET`;
      }
    }
    const resources = doc.addObject({ XObject: xobjects, Font: { F1: font } });
    doc.insertPage(
      -1,
      doc.addPage(
        [0, 0, 595, 842],
        spec.kind === "scan" ? spec.rotate ?? 0 : 0,
        resources,
        content,
      ),
    );
    if (spec.kind === "scan" && spec.stamp) {
      const page = doc.loadPage(doc.countPages() - 1) as mupdf.PDFPage;
      const stamp = page.createAnnotation("Stamp");
      stamp.setRect([400, 700, 560, 780]);
      stamp.update();
      page.update();
    }
  }
  const buffer = doc.saveToBuffer("");
  try {
    return buffer.asUint8Array().slice();
  } finally {
    buffer.destroy();
    doc.destroy();
  }
}

/** Width and height of any image mupdf can open. */
export function imageSize(bytes: Uint8Array): [number, number] {
  const image = new mupdf.Image(bytes);
  try {
    return [image.getWidth(), image.getHeight()];
  } finally {
    image.destroy();
  }
}
