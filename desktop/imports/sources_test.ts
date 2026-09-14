import { assert, assertEquals, assertThrows } from "@std/assert";
import { simplePdf } from "../ocr/simple-pdf.ts";
import { ImportError } from "./messages.ts";
import { MAX_SCAN_SIDE, pagesFromUpload, sniffType } from "./sources.ts";
import { imageSize, scanJpeg, testPdf } from "./testing.ts";

// Every page here is drawn from made-up lines; no real report is used.

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? [...new TextEncoder().encode(p)] : p
    ),
  );
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0]);
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");

const pdfPages = (pdf: Uint8Array, name = "scan.pdf") =>
  pagesFromUpload([{ name, bytes: pdf }]).pages;

Deno.test("files are recognised by their first bytes, not their names", () => {
  assertEquals(sniffType(PNG), "image/png");
  assertEquals(sniffType(JPEG), "image/jpeg");
  assertEquals(sniffType(WEBP), "image/webp");
  assertEquals(sniffType(simplePdf([["A PAGE"]])), "application/pdf");
  assertEquals(
    sniffType(bytes("junk before the header\n%PDF-1.4")),
    "application/pdf",
  );
  assertEquals(sniffType(bytes("RIFF", [0, 0, 0, 0], "WAVE")), null);
  assertEquals(sniffType(bytes("Test,Result\nGlucose,5.2\n")), null);
  assertEquals(sniffType(new Uint8Array()), null);
});

Deno.test("each page of a typed PDF is rendered as a PNG named after the file", () => {
  const pdf = simplePdf([
    ["NORTHSIDE PATHOLOGY", "HAEMOGLOBIN   13.1   g/dL   12.0 - 15.5"],
    ["NORTHSIDE PATHOLOGY", "GLUCOSE   5.2   mmol/L   3.9 - 6.0"],
  ]);
  const upload = pagesFromUpload([
    { name: "northside-2026-05-11.pdf", bytes: pdf },
  ]);
  assertEquals(upload.source, "pdf");
  assertEquals(upload.report, "northside-2026-05-11");
  assertEquals(upload.pages.map((p) => [p.name, p.type, p.origin]), [
    ["northside-2026-05-11-1.png", "image/png", "rendered"],
    ["northside-2026-05-11-2.png", "image/png", "rendered"],
  ]);
  for (const page of upload.pages) {
    // An A4 page at 150 dpi.
    assertEquals(imageSize(page.bytes), [1240, 1755]);
  }
});

Deno.test("a scanned page is sent as the scanner's own JPEG, untouched", () => {
  const jpeg = scanJpeg(200);
  const [page] = pdfPages(testPdf([{ kind: "scan", image: jpeg }]));
  assertEquals([page.name, page.type, page.origin], [
    "scan-1.jpg",
    "image/jpeg",
    "scanned",
  ]);
  assertEquals(page.bytes, jpeg);
  assertEquals(imageSize(page.bytes), [1653, 2339], "its own resolution");
});

Deno.test("a searchable scan, with its invisible text layer, is still a scan", () => {
  const jpeg = scanJpeg(200);
  const [page] = pdfPages(
    testPdf([{ kind: "scan", image: jpeg, hiddenText: true }]),
  );
  assertEquals(page.origin, "scanned");
  assertEquals(page.bytes, jpeg);
});

Deno.test("a page with anything besides one upright full-page scan is rendered", () => {
  const jpeg = scanJpeg(200);
  const pages = pdfPages(testPdf([
    { kind: "typed" },
    { kind: "scan", image: jpeg, rotate: 90 },
    { kind: "scan", image: jpeg, stamp: true },
    { kind: "scan", image: jpeg, margin: 60 },
    { kind: "scan", image: jpeg },
  ]));
  assertEquals(pages.map((p) => [p.origin, p.type]), [
    ["rendered", "image/png"],
    ["rendered", "image/png"],
    ["rendered", "image/png"],
    ["rendered", "image/png"],
    ["scanned", "image/jpeg"],
  ]);
  // The rotated page is rendered the way it's viewed: landscape.
  assertEquals(imageSize(pages[1].bytes), [1755, 1240]);
});

Deno.test("a lossless scan is decoded once at its own size; an oversized one is rendered down", () => {
  const [lossless, oversized] = pdfPages(testPdf([
    { kind: "scan", image: "lossless" },
    { kind: "scan", image: scanJpeg(450) },
  ]));

  assertEquals([lossless.origin, lossless.type], ["scanned", "image/jpeg"]);
  assertEquals(imageSize(lossless.bytes), [1653, 2339]);

  assertEquals([oversized.origin, oversized.type], ["rendered", "image/png"]);
  const [width, height] = imageSize(oversized.bytes);
  assert(
    Math.abs(height - MAX_SCAN_SIDE) <= 1 && width < height,
    `rendered at ${width}x${height}`,
  );
});

Deno.test("photos are pages in the order given, as they are", () => {
  const upload = pagesFromUpload([
    { name: "IMG_2041.webp", bytes: WEBP },
    { name: "IMG_2042.jpg", bytes: JPEG },
  ]);
  assertEquals(upload.source, "photos");
  assertEquals(upload.report, "IMG_2041");
  assertEquals(upload.pages, [
    { name: "IMG_2041.webp", type: "image/webp", bytes: WEBP, origin: "photo" },
    { name: "IMG_2042.jpg", type: "image/jpeg", bytes: JPEG, origin: "photo" },
  ]);
});

Deno.test("uploads that can't be read say why", () => {
  const refused = (files: { name: string; bytes: Uint8Array }[]) =>
    assertThrows(() => pagesFromUpload(files), ImportError).message;

  assertEquals(
    refused([]),
    "Nothing to read. Add a PDF or photos of a report.",
  );
  assertEquals(
    refused([{ name: "IMG_1.png", bytes: PNG }, {
      name: "results.csv",
      bytes: bytes("Test,Result\n"),
    }]),
    "results.csv isn't a PDF, JPG, PNG or WebP file.",
  );
  assertEquals(
    refused([{ name: "IMG_1.png", bytes: PNG }, {
      name: "report.pdf",
      bytes: simplePdf([["A PAGE"]]),
    }]),
    "report.pdf is a PDF, so it's read as a report of its own. Add it separately from other files.",
  );
  assertEquals(
    refused([{ name: "damaged.pdf", bytes: bytes("%PDF-1.4\nnot really") }]),
    "damaged.pdf couldn't be opened as a PDF. It may be damaged.",
  );
});
