/**
 * ocr-reports — OCR lab-report page images into structured JSON.
 *
 * Each image in "2.images" is sent to a local Ollama vision model, which
 * transcribes it under the rules in src/ocr-prompt.md. The reply is validated
 * against the Zod schema, written per page for debugging, then merged into one
 * report per group of pages in "3.data".
 *
 * Usage:
 *   deno task ocr
 *   deno task ocr --prefix "2026 March"
 */
import { parseArgs } from "@std/cli/parse-args";
import { ensureDir, exists } from "@std/fs";
import { basename, extname, fromFileUrl, join, resolve } from "@std/path";
import { encodeBase64 } from "@std/encoding/base64";
import { encodeHex } from "@std/encoding/hex";
import {
  type PageExtraction,
  pageExtractionJsonSchema,
  PageExtractionSchema,
  type Report,
} from "./schema.ts";
import { buildReport } from "./normalize.ts";

const DEFAULTS = {
  input: "2.images",
  output: "3.data",
  model: "qwen3.8:27b-mlx",
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
      --pages-only        Write per-page JSON but skip the merged report
  -n, --dry-run           List what would be processed, call nothing
  -h, --help              Show this help

EXAMPLES:
  deno run -RWN src/ocr-reports.ts --prefix "2026 March"
  deno run -RWN src/ocr-reports.ts --model gemma4:31b-mlx --force
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
    const pages = groups.get(name) ?? [];
    pages.push({ path: join(dir, entry.name), page: Number(page) });
    groups.set(name, pages);
  }

  return [...groups.entries()]
    .map(([name, pages]) => ({
      name,
      pages: pages.sort((a, b) => a.page - b.page),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type OllamaOptions = {
  host: string;
  model: string;
  context: number;
  retries: number;
  prompt: string;
};

async function assertModelAvailable(opts: OllamaOptions) {
  let response: Response;
  try {
    response = await fetch(`${opts.host}/api/tags`);
  } catch (cause) {
    throw new CliError(
      `cannot reach Ollama at ${opts.host} — is it running? (${
        cause instanceof Error ? cause.message : cause
      })`,
    );
  }
  const { models } = await response.json() as {
    models: { name: string; capabilities?: string[] }[];
  };
  const names = models.map((m) => m.name);
  if (!names.includes(opts.model)) {
    throw new CliError(
      `model ${opts.model} not found on ${opts.host}. Available: ${
        names.join(", ")
      }`,
    );
  }
}

async function ocrPage(
  image: Page,
  pageCount: number,
  opts: OllamaOptions,
): Promise<PageExtraction> {
  const encoded = encodeBase64(await Deno.readFile(image.path));
  const prompt = opts.prompt
    .replaceAll("{{PAGE}}", String(image.page))
    .replaceAll("{{PAGE_COUNT}}", String(pageCount));
  const format = pageExtractionJsonSchema();

  let feedback = "";
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(`${opts.host}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          stream: false,
          // The model can think; thinking only pollutes a transcription task.
          think: false,
          format,
          options: { temperature: 0, num_ctx: opts.context },
          messages: [{
            role: "user",
            content: feedback ? `${prompt}\n\n${feedback}` : prompt,
            images: [encoded],
          }],
        }),
      });
    } catch (cause) {
      throw new CliError(
        `request to ${opts.host} failed: ${
          cause instanceof Error ? cause.message : cause
        }`,
      );
    }

    if (!response.ok) {
      throw new CliError(
        `Ollama returned ${response.status}: ${(await response.text()).trim()}`,
      );
    }

    const body = await response.json();
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const content = body.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      feedback = "Your previous reply was not valid JSON. Return JSON only.";
      console.warn(`    attempt ${attempt + 1} (${elapsed}s): invalid JSON`);
      continue;
    }

    const result = PageExtractionSchema.safeParse(parsed);
    if (result.success) {
      console.log(
        `    ${elapsed}s, ${result.data.tests.length} test row(s)${
          result.data.warnings.length
            ? `, ${result.data.warnings.length} warning(s)`
            : ""
        }`,
      );
      return result.data;
    }

    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    feedback =
      `Your previous reply did not match the schema (${issues}). Fix those fields and return the whole JSON again.`;
    console.warn(`    attempt ${attempt + 1} (${elapsed}s): ${issues}`);
  }

  throw new CliError(
    `${basename(image.path)}: no valid response after ${
      opts.retries + 1
    } attempt(s)`,
  );
}

async function loadPrompt(): Promise<{ text: string; hash: string }> {
  const path = fromFileUrl(new URL("./ocr-prompt.md", import.meta.url));
  const text = await Deno.readTextFile(path);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return { text, hash: encodeHex(new Uint8Array(digest)).slice(0, 12) };
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
    boolean: ["help", "force", "pages-only", "dry-run"],
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

  const inputDir = resolve(flags.input);
  if (!(await Deno.stat(inputDir).catch(() => null))?.isDirectory) {
    fail(`input directory not found: ${flags.input}`);
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

  const prompt = await loadPrompt();
  const opts: OllamaOptions = {
    host: flags.host.replace(/\/$/, ""),
    model: flags.model,
    context,
    retries,
    prompt: prompt.text,
  };
  await assertModelAvailable(opts);
  await ensureDir(outputDir);

  const written: string[] = [];
  for (const group of groups) {
    console.log(`\n${group.name} — ${group.pages.length} page(s)`);
    const extractions: PageExtraction[] = [];

    for (const image of group.pages) {
      const pagePath = join(outputDir, `${group.name}-${image.page}.page.json`);
      const cached = !flags.force && await exists(pagePath)
        ? PageExtractionSchema.safeParse(
          JSON.parse(await Deno.readTextFile(pagePath)),
        )
        : null;

      if (cached?.success) {
        console.log(`  p${image.page} cached`);
        extractions.push(cached.data);
        continue;
      }

      console.log(`  p${image.page} ${basename(image.path)}`);
      const extraction = await ocrPage(image, group.pages.length, opts);
      await Deno.writeTextFile(
        pagePath,
        JSON.stringify(extraction, null, 2) + "\n",
      );
      written.push(pagePath);
      extractions.push(extraction);
    }

    if (flags["pages-only"]) continue;

    const report: Report = buildReport(extractions, {
      report: group.name,
      images: group.pages.map((p) => basename(p.path)),
      pages: group.pages.length,
      model: opts.model,
      host: opts.host,
      promptHash: prompt.hash,
      extractedAt: new Date().toISOString(),
    });

    const reportPath = join(outputDir, `${group.name}.json`);
    await Deno.writeTextFile(
      reportPath,
      JSON.stringify(report, null, 2) + "\n",
    );
    written.push(reportPath);

    console.log(
      `  → ${basename(reportPath)}: ${report.tests.length} test(s)${
        report.warnings.length ? `, ${report.warnings.length} warning(s)` : ""
      }`,
    );
    for (const warning of report.warnings) console.log(`    ! ${warning}`);
  }

  console.log(`\nwrote ${written.length} file(s) to ${flags.output}`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }
}
