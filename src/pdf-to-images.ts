/**
 * pdf-to-images — write each page of a PDF out as its own image file.
 *
 * Two modes:
 *   render (default)  rasterize each page at a chosen dpi
 *   --embedded        pull out the image each page already contains, byte for
 *                     byte where the PDF stores it in a real image format
 *
 * Usage:
 *   deno run --allow-read --allow-write src/pdf-to-images.ts --input chart.pdf --output wip
 *   deno task extract chart.pdf --embedded
 */
import { parseArgs } from "@std/cli/parse-args";
import { ensureDir, exists } from "@std/fs";
import { basename, extname, join, resolve } from "@std/path";
import * as mupdf from "mupdf";

const FORMATS = ["png", "jpeg"] as const;
type Format = typeof FORMATS[number];

const USAGE =
  `pdf-to-images — write each page of a PDF out as its own image file

USAGE:
  deno run --allow-read --allow-write src/pdf-to-images.ts [options] <input.pdf>

OPTIONS:
  -i, --input   <file>    Input .pdf file (may also be given positionally)
  -o, --output  <dir>     Output directory (default: wip)
  -p, --prefix  <name>    Output file prefix (default: input file's base name)
  -e, --embedded          Extract each page's embedded image instead of
                          rasterizing the page — lossless, and the original
                          resolution, for PDFs that are just scanned pages
  -f, --force             Overwrite existing files in the output directory
  -h, --help              Show this help

RENDER MODE ONLY (ignored with --embedded):
  -d, --dpi     <number>  Render resolution (default: 150)
  -F, --format  <fmt>     Image format: png or jpeg (default: png)
  -q, --quality <number>  JPEG quality, 0-100 (default: 90)
  -g, --grayscale         Render in grayscale instead of RGB

EXAMPLES:
  deno run --allow-read --allow-write src/pdf-to-images.ts charts/patient-01.pdf
  deno run --allow-read --allow-write src/pdf-to-images.ts -i in.pdf -d 300 -F jpeg
  deno run --allow-read --allow-write src/pdf-to-images.ts -i scan.pdf --embedded
`;

/** A runtime failure: reported without the usage banner. */
class CliError extends Error {}

function fail(msg: string): never {
  console.error(`error: ${msg}\n`);
  console.error(USAGE);
  Deno.exit(1);
}

async function main() {
  const flags = parseArgs(Deno.args, {
    string: ["input", "output", "prefix", "dpi", "format", "quality"],
    boolean: ["help", "force", "grayscale", "embedded"],
    alias: {
      i: "input",
      o: "output",
      p: "prefix",
      d: "dpi",
      F: "format",
      q: "quality",
      g: "grayscale",
      e: "embedded",
      f: "force",
      h: "help",
    },
    default: { output: "wip", dpi: "150", format: "png", quality: "90" },
  });

  if (flags.help) {
    console.log(USAGE);
    return;
  }

  const input = flags.input ?? (flags._[0] as string | undefined);
  if (!input) fail("no input PDF given");
  if (extname(input).toLowerCase() !== ".pdf") {
    fail(`input must be a .pdf file, got: ${input}`);
  }

  const format = flags.format.toLowerCase() as Format;
  if (!FORMATS.includes(format)) {
    fail(`unknown format: ${flags.format} (expected ${FORMATS.join(" or ")})`);
  }

  const dpi = Number(flags.dpi);
  if (!Number.isFinite(dpi) || dpi <= 0) fail(`invalid dpi: ${flags.dpi}`);

  const quality = Number(flags.quality);
  if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
    fail(`invalid quality: ${flags.quality} (expected 0-100)`);
  }

  const inputPath = resolve(input);
  const stat = await Deno.stat(inputPath).catch(() => null);
  if (!stat?.isFile) fail(`input file not found: ${input}`);

  const outputDir = resolve(flags.output);
  const prefix = flags.prefix ?? basename(inputPath, extname(inputPath));

  const doc = mupdf.Document.openDocument(
    await Deno.readFile(inputPath),
    "application/pdf",
  ) as mupdf.PDFDocument;
  const pageCount = doc.countPages();
  if (pageCount === 0) throw new CliError(`${input} has no pages`);

  // Work out every output up front — name, extension and how to produce the
  // bytes — so a naming conflict or a page that breaks the --embedded
  // assumption aborts before anything is written.
  const plan = flags.embedded
    ? planEmbedded(doc, pageCount)
    : planRendered(doc, pageCount, {
      dpi,
      format,
      quality,
      grayscale: flags.grayscale,
    });

  const width = String(pageCount).length;
  const targets = plan.map((item) => ({
    ...item,
    path: join(
      outputDir,
      `${prefix}-${
        String(item.page).padStart(width, "0")
      }${item.suffix}.${item.ext}`,
    ),
  }));

  if (!flags.force) {
    for (const { path } of targets) {
      if (await exists(path)) {
        throw new CliError(`${path} already exists (use --force to overwrite)`);
      }
    }
  }

  await ensureDir(outputDir);

  for (const { path, produce } of targets) {
    const { bytes, note } = produce();
    await Deno.writeFile(path, bytes);
    console.log(`  ${path} (${note})`);
  }

  console.log(
    flags.embedded
      ? `extracted ${targets.length} embedded image(s) from ${
        basename(inputPath)
      }`
      : `rendered ${
        basename(inputPath)
      } to ${pageCount} ${format} image(s) at ${dpi} dpi`,
  );
}

type PlanItem = {
  page: number;
  /** Disambiguator for pages holding more than one image. */
  suffix: string;
  ext: string;
  produce: () => { bytes: Uint8Array; note: string };
};

function planRendered(
  doc: mupdf.PDFDocument,
  pageCount: number,
  opts: { dpi: number; format: Format; quality: number; grayscale: boolean },
): PlanItem[] {
  // PDF user space is 72 units per inch, so the render scale is dpi / 72.
  const matrix = mupdf.Matrix.scale(opts.dpi / 72, opts.dpi / 72);
  const colorSpace = opts.grayscale
    ? mupdf.ColorSpace.DeviceGray
    : mupdf.ColorSpace.DeviceRGB;

  return Array.from({ length: pageCount }, (_, index) => ({
    page: index + 1,
    suffix: "",
    ext: opts.format === "jpeg" ? "jpg" : "png",
    produce: () => {
      const page = doc.loadPage(index);
      const pixmap = page.toPixmap(matrix, colorSpace, false, true);
      const bytes = opts.format === "jpeg"
        ? pixmap.asJPEG(opts.quality, false)
        : pixmap.asPNG();
      const note = `${pixmap.getWidth()}x${pixmap.getHeight()}`;
      pixmap.destroy();
      page.destroy();
      return { bytes, note };
    },
  }));
}

/**
 * Compression filters whose stream bytes are already a complete image file, so
 * the image can be written out untouched. Anything else (Flate, CCITT, JBIG2,
 * raw samples) only makes sense as pixels and gets re-encoded as PNG.
 */
const PASSTHROUGH: Record<string, string> = {
  DCTDecode: "jpg",
  JPXDecode: "jp2",
};

function planEmbedded(doc: mupdf.PDFDocument, pageCount: number): PlanItem[] {
  const plan: PlanItem[] = [];
  const bare: number[] = [];

  for (let index = 0; index < pageCount; index++) {
    const page = doc.loadPage(index) as mupdf.PDFPage;
    const images = findImages(page.getObject().getInheritable("Resources"));
    page.destroy();

    if (images.length === 0) {
      bare.push(index + 1);
      continue;
    }

    for (const [n, image] of images.entries()) {
      const filter = lastFilter(image.dict);
      const passthrough = filter ? PASSTHROUGH[filter] : undefined;
      plan.push({
        page: index + 1,
        // Pages that really are one scan per page get plain names.
        suffix: images.length > 1 ? `-${n + 1}` : "",
        ext: passthrough ?? "png",
        produce: () => {
          if (passthrough) {
            // The stream lives on the indirect reference; the resolved dict
            // has no object number and so can't be read as a stream.
            const bytes = image.ref.readRawStream().asUint8Array();
            const w = image.dict.get("Width").asNumber();
            const h = image.dict.get("Height").asNumber();
            return { bytes, note: `${w}x${h}, ${filter} verbatim` };
          }
          // Not a standalone image format on its own — decode and re-encode.
          const pixmap = doc.loadImage(image.ref).toPixmap();
          const bytes = pixmap.asPNG();
          const note = `${pixmap.getWidth()}x${pixmap.getHeight()}, ${
            filter ?? "raw"
          } re-encoded as PNG`;
          pixmap.destroy();
          return { bytes, note };
        },
      });
    }
  }

  if (bare.length > 0) {
    throw new CliError(
      `no embedded image on page(s) ${
        bare.join(", ")
      } — those pages hold text or vector content, so run without --embedded to rasterize instead`,
    );
  }
  return plan;
}

/**
 * An image XObject, kept as both the indirect reference (the only handle that
 * can read the stream) and the resolved dictionary (the only one that can read
 * the keys).
 */
type ImageXObject = { ref: mupdf.PDFObject; dict: mupdf.PDFObject };

/** Image XObjects on a page, descending into form XObjects. */
function findImages(
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
function lastFilter(image: mupdf.PDFObject): string | undefined {
  const filter = image.get("Filter");
  if (filter.isName()) return filter.asName();
  if (filter.isArray() && filter.length > 0) {
    const last = filter.get(filter.length - 1);
    if (last.isName()) return last.asName();
  }
  return undefined;
}

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }
}
