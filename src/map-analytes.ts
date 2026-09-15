/**
 * map-analytes — grow the analyte catalog from test names it doesn't know.
 *
 *   deno task map --list     show unmatched test names across merged reports
 *   deno task map            ask the local model to suggest matches
 *   deno task map --apply    add the suggestions you accepted to the catalog
 *
 * The model only suggests. Nothing reaches src/analytes.json until you set
 * "accept": true on a suggestion, and unit conversion factors are only ever
 * typed in by a person.
 */
import { ANALYTE_GROUPS } from "./analyte-groups.ts";
import { parseArgs } from "@std/cli/parse-args";
import { exists } from "@std/fs";
import { basename, fromFileUrl, join, resolve } from "@std/path";
import { z } from "@zod/zod";
import {
  type Catalog,
  type CatalogIndex,
  DEFAULT_CATALOG,
  formatCatalog,
  indexCatalog,
  loadCatalog,
  lookup,
  nameKey,
} from "./catalog.ts";
import { assertModelAvailable, chatJson, type OllamaConfig } from "./ollama.ts";
import { ReportSchema, type Specimen, SpecimenSchema } from "./schema.ts";
import { normalizeUnit, unitKey } from "./units.ts";

const DEFAULTS = {
  data: ".data/pipeline/readings",
  catalog: DEFAULT_CATALOG,
  model: "qwen3-vl:4b",
  host: "http://localhost:11434",
  retries: "2",
  context: "32768",
};

const SUGGESTIONS_FILE = "analyte-suggestions.json";

const USAGE = `map-analytes — grow the analyte catalog from unmatched test names

USAGE:
  deno run --allow-read --allow-write --allow-net src/map-analytes.ts [options]

MODES:
  (default)               Ask the model for suggestions; writes ${SUGGESTIONS_FILE}
  -l, --list              Only list unmatched names, call nothing
  -a, --apply             Add accepted suggestions to the catalog

OPTIONS:
  -d, --data    <dir>     Merged reports directory (default: ${DEFAULTS.data})
      --catalog <file>    Analyte catalog (default: src/analytes.json)
  -m, --model   <name>    Ollama model (default: ${DEFAULTS.model})
      --host    <url>     Ollama server (default: ${DEFAULTS.host})
      --retries <number>  Retries on invalid output (default: ${DEFAULTS.retries})
      --context <number>  Model context window (default: ${DEFAULTS.context})
  -f, --force             Overwrite an existing suggestions file
  -h, --help              Show this help

WORKFLOW:
  1. deno task map                  review ${DEFAULTS.data}/${SUGGESTIONS_FILE}
  2. set "accept": true on the ones that are right; fill in "factor" where asked
  3. deno task map --apply          updates the catalog
  4. deno task ocr --merge-only     re-merges reports with the new catalog
`;

class CliError extends Error {}

export type Item = {
  name: string;
  nameZh: string | null;
  specimen: Specimen | null;
  unit: string | null;
  headings: string[];
  referenceText: string | null;
  reason: string;
  reports: string[];
};

export const ModelSuggestionsSchema = z.object({
  suggestions: z.array(z.object({
    item: z.number().int(),
    action: z.enum(["alias", "new", "skip"]),
    analyteId: z.string().nullable(),
    name: z.string().nullable(),
    specimen: SpecimenSchema.nullable(),
    reason: z.string(),
  })),
});

const SuggestionSchema = z.object({
  accept: z.boolean(),
  action: z.enum(["alias", "new", "skip"]),
  analyteId: z.string().nullable(),
  name: z.string().nullable(),
  specimen: SpecimenSchema.nullable(),
  printedName: z.string(),
  nameZh: z.string().nullable(),
  unit: z.string().nullable(),
  /** Multiply a value in `unit` by this to get the analyte's unit. */
  factor: z.number().positive().nullable(),
  /** Dashboard section for a new analyte; "Other" when left null. */
  group: z.enum(ANALYTE_GROUPS).nullable(),
  headings: z.array(z.string()),
  reports: z.array(z.string()),
  reason: z.string(),
  /** Something a person must confirm or fill in before accepting. */
  check: z.string().nullable(),
});

const SuggestionFileSchema = z.object({
  instructions: z.string(),
  suggestions: z.array(SuggestionSchema),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

/** Unmatched names across merged reports, re-checked against today's catalog. */
export async function collectUnmatched(
  dataDir: string,
  catalog: CatalogIndex,
): Promise<Item[]> {
  const items = new Map<string, Item>();

  for await (const entry of Deno.readDir(dataDir)) {
    const file = entry.name;
    if (
      !entry.isFile || !file.endsWith(".json") || file.endsWith(".page.json") ||
      file === SUGGESTIONS_FILE
    ) continue;

    const parsed = ReportSchema.safeParse(
      JSON.parse(await Deno.readTextFile(join(dataDir, file))),
    );
    if (!parsed.success) {
      console.warn(
        `  skipping ${file}: not a current report (run deno task ocr --merge-only)`,
      );
      continue;
    }

    const report = basename(file, ".json");
    for (const test of parsed.data.tests) {
      if (test.analyte !== null) continue;
      const match = lookup(catalog, {
        name: test.name,
        specimen: test.specimen,
        unit: test.unit,
      });
      if (match.kind === "mapped") continue;

      const key = `${nameKey(test.name)}|${test.specimen ?? ""}|${
        unitKey(test.unit)
      }`;
      const item = items.get(key) ?? {
        name: test.name,
        nameZh: test.nameZh,
        specimen: test.specimen,
        unit: test.unit,
        headings: test.headings,
        referenceText: test.printed.referenceText,
        reason: match.reason,
        reports: [],
      };
      if (!item.reports.includes(report)) item.reports.push(report);
      items.set(key, item);
    }
  }

  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function describe(item: Item): string {
  return `${item.name} [${item.unit ?? "no unit"}, ${
    item.specimen ?? "specimen unknown"
  }]`;
}

/** Turns a model suggestion into a reviewable entry, with anything to check. */
export function toSuggestion(
  item: Item,
  proposal:
    | z.infer<typeof ModelSuggestionsSchema>["suggestions"][number]
    | undefined,
  catalog: CatalogIndex,
): Suggestion {
  const base = {
    accept: false,
    group: null,
    printedName: item.name,
    nameZh: item.nameZh,
    unit: item.unit,
    headings: item.headings,
    reports: item.reports,
  };

  if (!proposal) {
    return {
      ...base,
      action: "new",
      analyteId: null,
      name: null,
      specimen: item.specimen,
      factor: 1,
      reason: "the model returned no suggestion for this item",
      check:
        "decide manually: fill in analyteId, name and specimen, or change action",
    };
  }

  if (proposal.action === "alias") {
    const analyte = proposal.analyteId
      ? catalog.byId.get(proposal.analyteId)
      : undefined;
    if (!analyte) {
      return {
        ...base,
        action: "alias",
        analyteId: proposal.analyteId,
        name: null,
        specimen: item.specimen,
        factor: null,
        reason: proposal.reason,
        check:
          `"${proposal.analyteId}" is not in the catalog — fix analyteId or change action`,
      };
    }
    const factor = analyte.factors.get(unitKey(item.unit)) ?? null;
    const checks: string[] = [];
    if (item.specimen && item.specimen !== analyte.specimen) {
      checks.push(
        `specimen differs (printed ${item.specimen}, ${analyte.id} is ${analyte.specimen})`,
      );
    }
    if (factor === null) {
      checks.push(
        `unit "${
          item.unit ?? "none"
        }" is new for ${analyte.id}: set factor so value × factor is in ${
          analyte.unit || "no unit"
        }`,
      );
    }
    return {
      ...base,
      action: "alias",
      analyteId: analyte.id,
      name: analyte.name,
      specimen: analyte.specimen,
      factor,
      reason: proposal.reason,
      check: checks.length ? checks.join("; ") : null,
    };
  }

  if (proposal.action === "new") {
    const checks: string[] = [];
    const id = proposal.analyteId;
    if (!id || !/^[a-z0-9_]+$/.test(id)) {
      checks.push("analyteId must be lowercase snake_case");
    } else if (catalog.byId.has(id)) {
      checks.push(
        `analyteId "${id}" already exists — pick another or use alias`,
      );
    }
    if (!proposal.name) checks.push("name is missing");
    if (!(proposal.specimen ?? item.specimen)) {
      checks.push("specimen is missing");
    }
    if (
      item.specimen && proposal.specimen && proposal.specimen !== item.specimen
    ) {
      checks.push(
        `the model changed the specimen from the printed ${item.specimen} to ${proposal.specimen} — confirm before accepting`,
      );
    }
    return {
      ...base,
      action: "new",
      analyteId: id,
      name: proposal.name,
      specimen: proposal.specimen ?? item.specimen,
      factor: 1,
      reason: proposal.reason,
      check: checks.length ? checks.join("; ") : null,
    };
  }

  return {
    ...base,
    action: "skip",
    analyteId: null,
    name: null,
    specimen: item.specimen,
    factor: null,
    reason: proposal.reason,
    check: null,
  };
}

async function suggest(
  items: Item[],
  catalog: CatalogIndex,
  config: OllamaConfig,
): Promise<Suggestion[]> {
  const template = await Deno.readTextFile(
    fromFileUrl(new URL("./map-prompt.md", import.meta.url)),
  );
  const catalogLines = catalog.catalog.analytes
    .map((a) =>
      [
        a.id,
        a.name,
        a.specimen,
        a.unit || "none",
        Object.keys(a.units).map((u) => u || "none").join(", "),
        a.aliases.join(", "),
      ].join(" | ")
    )
    .join("\n");
  const itemLines = items
    .map((item, i) =>
      [
        i + 1,
        item.name,
        item.nameZh ?? "-",
        item.specimen ?? "unknown",
        item.unit ?? "none",
        item.headings.join(" > ") || "-",
        item.referenceText ?? "-",
        item.reason,
      ].join(" | ")
    )
    .join("\n");

  const { data, seconds } = await chatJson(config, {
    label: "analyte suggestions",
    prompt: template
      .replace("{{CATALOG}}", catalogLines)
      .replace("{{ITEMS}}", itemLines),
    schema: ModelSuggestionsSchema,
  });
  console.log(`  model replied in ${seconds.toFixed(1)}s`);

  return items.map((item, i) =>
    toSuggestion(
      item,
      data.suggestions.find((s) => s.item === i + 1),
      catalog,
    )
  );
}

/** Applies accepted suggestions; returns the ones still pending review. */
export function applySuggestions(
  suggestions: Suggestion[],
  index: CatalogIndex,
): { catalog: Catalog; applied: string[]; pending: Suggestion[] } {
  const catalog: Catalog = structuredClone(index.catalog);
  const applied: string[] = [];
  const errors: string[] = [];

  for (const s of suggestions) {
    if (!s.accept || s.action === "skip") continue;
    const label = `${s.printedName} [${s.unit ?? "no unit"}]`;

    if (s.action === "alias") {
      const analyte = catalog.analytes.find((a) => a.id === s.analyteId);
      if (!analyte) {
        errors.push(`${label}: analyte "${s.analyteId}" is not in the catalog`);
        continue;
      }
      const knowsUnit = Object.keys(analyte.units).some((u) =>
        unitKey(u) === unitKey(s.unit)
      );
      if (!knowsUnit) {
        if (s.factor === null) {
          errors.push(
            `${label}: set "factor" to convert ${s.unit ?? "no unit"} into ${
              analyte.unit || "no unit"
            } before accepting`,
          );
          continue;
        }
        analyte.units[normalizeUnit(s.unit) ?? ""] = s.factor;
      }
      if (!analyte.aliases.some((a) => nameKey(a) === nameKey(s.printedName))) {
        analyte.aliases.push(s.printedName);
      }
      applied.push(`${label} → alias of ${analyte.id}`);
      continue;
    }

    if (!s.analyteId || !/^[a-z0-9_]+$/.test(s.analyteId)) {
      errors.push(`${label}: analyteId must be lowercase snake_case`);
      continue;
    }
    if (catalog.analytes.some((a) => a.id === s.analyteId)) {
      errors.push(`${label}: analyteId "${s.analyteId}" already exists`);
      continue;
    }
    if (!s.name || !s.specimen) {
      errors.push(`${label}: a new analyte needs a name and specimen`);
      continue;
    }
    const unit = normalizeUnit(s.unit) ?? "";
    catalog.analytes.push({
      id: s.analyteId,
      name: s.name,
      specimen: s.specimen,
      group: s.group ?? "Other",
      unit,
      aliases: [s.printedName],
      units: { [unit]: 1 },
    });
    applied.push(`${label} → new analyte ${s.analyteId}`);
  }

  if (errors.length) {
    throw new CliError(
      `nothing applied; fix these first:\n  ${errors.join("\n  ")}`,
    );
  }

  // Throws if the additions would make any printed name ambiguous.
  indexCatalog(catalog);
  return {
    catalog,
    applied,
    pending: suggestions.filter((s) => !s.accept),
  };
}

async function main() {
  const flags = parseArgs(Deno.args, {
    string: ["data", "catalog", "model", "host", "retries", "context"],
    boolean: ["help", "list", "apply", "force"],
    alias: {
      d: "data",
      m: "model",
      l: "list",
      a: "apply",
      f: "force",
      h: "help",
    },
    default: DEFAULTS,
  });

  if (flags.help) {
    console.log(USAGE);
    return;
  }
  if (flags.list && flags.apply) {
    throw new CliError("--list and --apply are separate modes");
  }

  const dataDir = resolve(flags.data);
  const catalogPath = resolve(flags.catalog);
  const suggestionsPath = join(dataDir, SUGGESTIONS_FILE);
  const catalog = await loadCatalog(catalogPath);

  if (flags.apply) {
    if (!(await exists(suggestionsPath))) {
      throw new CliError(
        `no ${SUGGESTIONS_FILE} in ${flags.data} — run deno task map first`,
      );
    }
    const file = SuggestionFileSchema.parse(
      JSON.parse(await Deno.readTextFile(suggestionsPath)),
    );
    const result = applySuggestions(file.suggestions, catalog);
    if (result.applied.length === 0) {
      console.log(`no accepted suggestions in ${SUGGESTIONS_FILE}`);
      return;
    }

    await Deno.writeTextFile(catalogPath, formatCatalog(result.catalog));
    if (result.pending.length) {
      await Deno.writeTextFile(
        suggestionsPath,
        JSON.stringify({ ...file, suggestions: result.pending }, null, 2) +
          "\n",
      );
    } else {
      await Deno.remove(suggestionsPath);
    }

    for (const line of result.applied) console.log(`  + ${line}`);
    console.log(
      `\nupdated ${
        basename(catalogPath)
      }; ${result.pending.length} suggestion(s) still pending`,
    );
    console.log("re-merge reports with: deno task ocr --merge-only");
    return;
  }

  if (!(await Deno.stat(dataDir).catch(() => null))?.isDirectory) {
    throw new CliError(
      `no merged reports: ${flags.data} doesn't exist — run deno task ocr first`,
    );
  }
  const items = await collectUnmatched(dataDir, catalog);
  if (items.length === 0) {
    console.log("every test in the merged reports matches the catalog");
    return;
  }

  console.log(`${items.length} unmatched test name(s):`);
  for (const item of items) {
    console.log(
      `  ${describe(item)} — ${item.reason} (${item.reports.join(", ")})`,
    );
  }
  if (flags.list) return;

  if (await exists(suggestionsPath) && !flags.force) {
    throw new CliError(
      `${SUGGESTIONS_FILE} already exists — apply or delete it first, or pass --force`,
    );
  }

  const retries = Number(flags.retries);
  const context = Number(flags.context);
  if (!Number.isInteger(retries) || retries < 0) {
    throw new CliError(`invalid retries: ${flags.retries}`);
  }
  if (!Number.isInteger(context) || context <= 0) {
    throw new CliError(`invalid context: ${flags.context}`);
  }
  const config: OllamaConfig = {
    host: flags.host.replace(/\/$/, ""),
    model: flags.model,
    context,
    retries,
  };
  await assertModelAvailable(config);

  console.log(`\nasking ${config.model} for suggestions…`);
  const suggestions = await suggest(items, catalog, config);
  await Deno.writeTextFile(
    suggestionsPath,
    JSON.stringify(
      {
        instructions:
          'Review each suggestion. Set "accept": true on the ones that are right, fix any field you disagree with, and fill in "factor" where "check" asks. Then run: deno task map --apply',
        suggestions,
      },
      null,
      2,
    ) + "\n",
  );

  console.log("");
  for (const s of suggestions) {
    const target = s.action === "skip"
      ? "skip"
      : `${s.action} ${s.analyteId ?? "?"}`;
    console.log(`  ${s.printedName} [${s.unit ?? "no unit"}] → ${target}`);
    if (s.check) console.log(`      check: ${s.check}`);
  }
  console.log(
    `\nwrote ${
      join(flags.data, SUGGESTIONS_FILE)
    } — review it, then deno task map --apply`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }
}
