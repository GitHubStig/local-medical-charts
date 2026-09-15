/**
 * ocr-reports — OCR lab-report page images into structured JSON.
 *
 * Each image in ".data/pipeline/images" is sent to a local Ollama vision model, which
 * transcribes it under the rules in src/ocr-prompt.md. Replies are validated
 * against the Zod schema and cached per page in ".data/pipeline/readings". Pages are then merged
 * into one report per group, with every result matched against the analyte
 * catalog in src/analytes.json.
 *
 * Usage:
 *   deno task ocr
 *   deno task ocr --prefix "sample-report"
 *   deno task ocr --merge-only      # re-merge cached pages after a catalog edit
 */
import { parseArgs } from "@std/cli/parse-args";
import { ensureDir, exists } from "@std/fs";
import { basename, extname, join, resolve } from "@std/path";
import { encodeBase64 } from "@std/encoding/base64";
import { loadCatalog } from "./catalog.ts";
import { buildReport } from "./normalize.ts";
import { OCR_PROMPT, pagePrompt, promptHash } from "./ocr-prompt.ts";
import { assertModelAvailable, chatJson, type OllamaConfig } from "./ollama.ts";
import {
  PageExtractionSchema,
  type PageFile,
  PageFileSchema,
  ReportSchema,
  SCHEMA_VERSION,
} from "./schema.ts";

const DEFAULTS = {
  input: ".data/pipeline/images",
  output: ".data/pipeline/readings",
  model: "qwen3-vl:4b",
  host: "http://localhost:11434",
  retries: "2",
  context: "16384",
};

const USAGE = `ocr-reports — OCR lab-report page images into structured JSON

USAGE:
  deno run --allow-read --allow-write --allow-net src/ocr-reports.ts [options]

OPTIONS:
  -i, --input   <dir>     Image directory (default: ${DEFAULTS.input})
  -o, --output  <dir>     JSON directory (default: ${DEFAULTS.output})
  -p, --prefix  <name>    Only images whose name starts with this
  -m, --model   <name>    Ollama vision model (default: ${DEFAULTS.model})
      --host    <url>     Ollama server (default: ${DEFAULTS.host})
      --retries <number>  Retries per page on invalid output (default: ${DEFAULTS.retries})
      --context <number>  Model context window (default: ${DEFAULTS.context})
  -f, --force             Re-OCR pages that already have a .page.json
      --merge-only        Only re-merge cached pages (after editing the catalog)
      --pages-only        Write per-page JSON but skip the merged report
  -n, --dry-run           List what would be processed, call nothing
  -h, --help              Show this help

EXAMPLES:
  deno run -RWN src/ocr-reports.ts --prefix "sample-report"
  deno run -RWN src/ocr-reports.ts --model gemma4:31b-mlx --force
  deno run -RWN src/ocr-reports.ts --merge-only
`;

class CliError extends Error {}

function fail(msg: string): never {
  console.error(`error: ${msg}\n`);
  console.error(USAGE);
  Deno.exit(1);
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

type Page = { path: string; page: number };
type Group = { name: string; pages: Page[] };

/**
 * Images are named `<report>-<page>.<ext>` by pdf-to-images, so the name
 * before the final `-N` identifies the report the page belongs to.
 */
async function findGroups(dir: string, prefix?: string): Promise<Group[]> {
  const groups = new Map<string, Page[]>();

  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    if (prefix && !entry.name.startsWith(prefix)) continue;

    const match = basename(entry.name, ext).match(/^(.*)-(\d+)$/);
    if (!match) {
      console.warn(`  skipping ${entry.name}: no "-<page>" suffix`);
      continue;
    }
    const [, name, page] = match;
    groups.set(name, [
      ...(groups.get(name) ?? []),
      { path: join(dir, entry.name), page: Number(page) },
    ]);
  }

  return [...groups.entries()]
    .map(([name, pages]) => ({
      name,
      pages: pages.sort((a, b) => a.page - b.page),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadPrompt(): Promise<{ text: string; hash: string }> {
  return { text: OCR_PROMPT, hash: await promptHash(OCR_PROMPT) };
}

async function ocrPage(
  image: Page,
  pageCount: number,
  config: OllamaConfig,
  prompt: { text: string; hash: string },
): Promise<PageFile> {
  const { data, seconds } = await chatJson(config, {
    label: basename(image.path),
    prompt: pagePrompt(image.page, pageCount, prompt.text),
    images: [encodeBase64(await Deno.readFile(image.path))],
    schema: PageExtractionSchema,
  });

  const rows = data.tests.length;
  const results = data.tests.reduce((n, t) => n + t.measurements.length, 0);
  console.log(
    `    ${seconds.toFixed(1)}s, ${rows} row(s), ${results} result(s)${
      data.warnings.length ? `, ${data.warnings.length} warning(s)` : ""
    }`,
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    model: config.model,
    promptHash: prompt.hash,
    extractedAt: new Date().toISOString(),
    extraction: data,
  };
}

async function main() {
  const flags = parseArgs(Deno.args, {
    string: [
      "input",
      "output",
      "prefix",
      "model",
      "host",
      "retries",
      "context",
    ],
    boolean: ["help", "force", "merge-only", "pages-only", "dry-run"],
    alias: {
      i: "input",
      o: "output",
      p: "prefix",
      m: "model",
      f: "force",
      n: "dry-run",
      h: "help",
    },
    default: DEFAULTS,
  });

  if (flags.help) {
    console.log(USAGE);
    return;
  }

  const retries = Number(flags.retries);
  if (!Number.isInteger(retries) || retries < 0) {
    fail(`invalid retries: ${flags.retries}`);
  }
  const context = Number(flags.context);
  if (!Number.isInteger(context) || context <= 0) {
    fail(`invalid context: ${flags.context}`);
  }
  if (flags["merge-only"] && (flags.force || flags["pages-only"])) {
    fail("--merge-only cannot be combined with --force or --pages-only");
  }

  const inputDir = resolve(flags.input);
  if (!(await Deno.stat(inputDir).catch(() => null))?.isDirectory) {
    fail(
      `input directory not found: ${flags.input} — run deno task extract first`,
    );
  }
  const outputDir = resolve(flags.output);

  const groups = await findGroups(inputDir, flags.prefix);
  if (groups.length === 0) {
    throw new CliError(
      `no page images in ${flags.input}${
        flags.prefix ? ` matching prefix "${flags.prefix}"` : ""
      }`,
    );
  }

  if (flags["dry-run"]) {
    for (const group of groups) {
      console.log(`${group.name} — ${group.pages.length} page(s)`);
      for (const page of group.pages) {
        console.log(`  p${page.page} ${basename(page.path)}`);
      }
    }
    return;
  }

  const catalog = await loadCatalog();
  const prompt = await loadPrompt();
  const config: OllamaConfig = {
    host: flags.host.replace(/\/$/, ""),
    model: flags.model,
    context,
    retries,
  };
  if (!flags["merge-only"]) await assertModelAvailable(config);
  await ensureDir(outputDir);

  let written = 0;
  let unmappedTotal = 0;

  for (const group of groups) {
    console.log(`\n${group.name} — ${group.pages.length} page(s)`);
    const files: PageFile[] = [];

    for (const image of group.pages) {
      const pagePath = join(outputDir, `${group.name}-${image.page}.page.json`);
      const cached = !flags.force && await exists(pagePath)
        ? PageFileSchema.safeParse(
          JSON.parse(await Deno.readTextFile(pagePath)),
        )
        : null;

      if (cached?.success) {
        console.log(`  p${image.page} cached`);
        files.push(cached.data);
        continue;
      }
      if (flags["merge-only"]) {
        throw new CliError(
          `${basename(pagePath)} ${
            cached
              ? `does not match schemaVersion ${SCHEMA_VERSION}`
              : "is missing"
          } — run without --merge-only to OCR it`,
        );
      }

      console.log(`  p${image.page} ${basename(image.path)}`);
      const file = await ocrPage(image, group.pages.length, config, prompt);
      await Deno.writeTextFile(pagePath, JSON.stringify(file, null, 2) + "\n");
      written++;
      files.push(file);
    }

    if (flags["pages-only"]) continue;

    const report = ReportSchema.parse(
      buildReport(
        files.map(({ schemaVersion: _, ...file }, i) => ({
          ...file,
          image: basename(group.pages[i].path),
        })),
        {
          report: group.name,
          catalogHash: catalog.hash,
          mergedAt: new Date().toISOString(),
        },
        catalog,
      ),
    );

    const reportPath = join(outputDir, `${group.name}.json`);
    await Deno.writeTextFile(
      reportPath,
      JSON.stringify(report, null, 2) + "\n",
    );
    written++;

    const matched = report.tests.filter((t) => t.analyte !== null).length;
    const flagged = report.tests.filter((t) => t.flag !== null).length;
    console.log(
      `  → ${
        basename(reportPath)
      }: ${report.tests.length} result(s), ${matched} matched to the catalog, ${flagged} flagged`,
    );
    for (const u of report.unmapped) {
      console.log(
        `    ? ${u.name} [${u.unit ?? "no unit"}, ${
          u.specimen ?? "specimen unknown"
        }]: ${u.reason}`,
      );
    }
    for (const warning of report.warnings) console.log(`    ! ${warning}`);
    unmappedTotal += report.unmapped.length;
  }

  console.log(`\nwrote ${written} file(s) to ${flags.output}`);
  if (unmappedTotal > 0) {
    console.log(
      `${unmappedTotal} test name(s) not in the catalog — review them with: deno task map`,
    );
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }
}
