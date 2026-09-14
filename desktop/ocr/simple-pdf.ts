/**
 * Small PDFs of plain text lines: the image Test connection reads, and
 * fictional report pages for tests. The cross-reference table gets real byte
 * offsets, so mupdf reads them without repairing (and without logging that).
 */

export type SimplePdfOptions = {
  /** Page size in points (1/72 inch). A4 by default. */
  width?: number;
  height?: number;
  fontSize?: number;
  margin?: number;
  lineHeight?: number;
};

const escapeText = (line: string) => line.replace(/[\\()]/g, (c) => `\\${c}`);

/** One page per entry, each a list of ASCII lines set in Courier from the top left. */
export function simplePdf(
  pages: string[][],
  options: SimplePdfOptions = {},
): Uint8Array {
  const {
    width = 595,
    height = 842,
    fontSize = 11,
    margin = 48,
    lineHeight = Math.round(fontSize * 1.6),
  } = options;
  const lines = pages.flat();
  if (lines.some((line) => /[^\x20-\x7e]/.test(line))) {
    throw new Error("simplePdf only sets printable ASCII");
  }

  // 1 catalog, 2 page tree, 3 font, then each page followed by its content.
  const pageRef = (i: number) => `${4 + i * 2} 0 R`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${
      pages.map((_, i) => pageRef(i)).join(" ")
    }] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];
  for (const [i, pageLines] of pages.entries()) {
    const shown = pageLines.map((line) => `(${escapeText(line)}) Tj`)
      .join(" T* ");
    const content = `BT /F1 ${fontSize} Tf ${lineHeight} TL ${margin} ${
      height - margin - fontSize
    } Td ${shown} ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${
        5 + i * 2
      } 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }

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
