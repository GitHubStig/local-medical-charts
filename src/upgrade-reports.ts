/**
 * upgrade-reports — bring merged reports in ".data/pipeline/readings" up to the current schema
 * version and catalog, re-merging them from their embedded pages.
 *
 * Usage:
 *   deno task upgrade --dry-run
 *   deno task upgrade
 *   deno task upgrade --force      # re-merge even when already current
 */
import { parseArgs } from "@std/cli/parse-args";
import { join, resolve } from "@std/path";
import { loadCatalog } from "./catalog.ts";
import { SCHEMA_VERSION } from "./schema.ts";
import { upgradeReport } from "./upgrade.ts";

const USAGE =
  `upgrade-reports — upgrade merged reports to the current format and catalog

USAGE:
  deno run --allow-read --allow-write src/upgrade-reports.ts [options]

OPTIONS:
  -d, --data <dir>   Merged reports directory (default: .data/pipeline/readings)
  -f, --force        Re-merge every report, even ones already current
  -n, --dry-run      Report what would change, write nothing
  -h, --help         Show this help
`;

/** Files in the data directory that are not merged reports. */
function isMergedReport(name: string): boolean {
  return name.endsWith(".json") && !name.endsWith(".page.json") &&
    name !== "analyte-suggestions.json";
}

async function main() {
  const flags = parseArgs(Deno.args, {
    string: ["data"],
    boolean: ["force", "dry-run", "help"],
    alias: { d: "data", f: "force", n: "dry-run", h: "help" },
    default: { data: ".data/pipeline/readings" },
  });
  if (flags.help) {
    console.log(USAGE);
    return;
  }

  const dir = resolve(flags.data);
  if (!(await Deno.stat(dir).catch(() => null))?.isDirectory) {
    throw new Error(
      `no merged reports: ${flags.data} doesn't exist — run deno task ocr first`,
    );
  }
  const catalog = await loadCatalog();
  const files = [...Deno.readDirSync(dir)]
    .filter((e) => e.isFile && isMergedReport(e.name))
    .map((e) => e.name)
    .sort();

  if (files.length === 0) {
    console.log(`no merged reports in ${flags.data}`);
    return;
  }

  let changed = 0;
  let failed = 0;
  for (const name of files) {
    const path = join(dir, name);
    try {
      const result = upgradeReport(
        JSON.parse(await Deno.readTextFile(path)),
        catalog,
        { force: flags.force },
      );
      if (!result.changed) {
        console.log(`  ${name}: up to date (v${result.toVersion})`);
        continue;
      }
      changed++;
      const versions = result.fromVersion === result.toVersion
        ? `v${result.toVersion}`
        : `v${result.fromVersion} → v${result.toVersion}`;
      console.log(
        `  ${name}: ${versions}, re-merged (${result.reasons.join(", ")})`,
      );
      for (const m of result.migrations) console.log(`      migration: ${m}`);
      if (!flags["dry-run"]) {
        await Deno.writeTextFile(
          path,
          JSON.stringify(result.report, null, 2) + "\n",
        );
      }
    } catch (err) {
      failed++;
      console.error(
        `  ${name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const verb = flags["dry-run"] ? "would upgrade" : "upgraded";
  console.log(
    `\n${verb} ${changed} of ${files.length} report(s) to v${SCHEMA_VERSION} with catalog ${catalog.hash}${
      failed ? `; ${failed} failed` : ""
    }`,
  );
  if (failed) Deno.exit(1);
}

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }
}
