/**
 * The analyte catalog: which printed test names are the same measurement.
 *
 * Laboratories print one test under many names ("Total WBC", "White Cell
 * Count") and different tests under one name (blood vs urine "Glucose").
 * Matching is an exact lookup on name, specimen and unit — never fuzzy — so a
 * result is only charted alongside others when the catalog says they are the
 * same analyte. Unknown names stay unmapped until a person adds them, with help
 * from `deno task map`.
 */
import { z } from "@zod/zod";
import { encodeHex } from "@std/encoding/hex";
import { fromFileUrl } from "@std/path";
import { type Specimen, SpecimenSchema } from "./schema.ts";
import { unitKey } from "./units.ts";

export const DEFAULT_CATALOG = fromFileUrl(
  new URL("./analytes.json", import.meta.url),
);

export const AnalyteSchema = z.object({
  /** Stable key results are charted under. Never rename once reports use it. */
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  specimen: SpecimenSchema,
  /** Unit results are converted into for charting; "" when dimensionless. */
  unit: z.string(),
  /** Printed names that mean this analyte, in any spelling or case. */
  aliases: z.array(z.string()).min(1),
  /** Accepted printed unit → factor that converts a value into `unit`. */
  units: z.record(z.string(), z.number().positive()),
});

export const CatalogSchema = z.object({ analytes: z.array(AnalyteSchema) });

export type Analyte = z.infer<typeof AnalyteSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;

type IndexedAnalyte = Analyte & { factors: Map<string, number> };

export type CatalogIndex = {
  catalog: Catalog;
  /** Short content hash, recorded in reports for provenance. */
  hash: string;
  byId: Map<string, IndexedAnalyte>;
  byAlias: Map<string, IndexedAnalyte[]>;
};

export type Match =
  | { kind: "mapped"; analyte: Analyte; factor: number }
  | { kind: "unmapped"; reason: string };

/** "ALT (SGPT)" → "alt sgpt"; "pH:" → "ph". */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Builds lookup tables, rejecting a catalog that could match one printed name
 * to two analytes — the failure that would silently merge different tests.
 */
export function indexCatalog(catalog: Catalog, hash = ""): CatalogIndex {
  const byId = new Map<string, IndexedAnalyte>();
  const byAlias = new Map<string, IndexedAnalyte[]>();

  for (const analyte of catalog.analytes) {
    if (byId.has(analyte.id)) {
      throw new Error(`catalog: duplicate analyte id "${analyte.id}"`);
    }
    const factors = new Map<string, number>();
    for (const [unit, factor] of Object.entries(analyte.units)) {
      factors.set(unitKey(unit), factor);
    }
    if (factors.get(unitKey(analyte.unit)) !== 1) {
      throw new Error(
        `catalog: ${analyte.id} must list its own unit "${analyte.unit}" with factor 1`,
      );
    }

    const indexed = { ...analyte, factors };
    byId.set(analyte.id, indexed);
    for (const alias of new Set(analyte.aliases.map(nameKey))) {
      byAlias.set(alias, [...(byAlias.get(alias) ?? []), indexed]);
    }
  }

  // Analytes may share a name only when specimen or unit tells them apart.
  for (const [alias, analytes] of byAlias) {
    for (let i = 0; i < analytes.length; i++) {
      for (let j = i + 1; j < analytes.length; j++) {
        const [a, b] = [analytes[i], analytes[j]];
        if (a.specimen !== b.specimen) continue;
        const shared = [...a.factors.keys()].find((unit) =>
          b.factors.has(unit)
        );
        if (shared !== undefined) {
          throw new Error(
            `catalog: "${alias}" is ambiguous between ${a.id} and ${b.id} (both ${a.specimen}, unit "${
              shared || "none"
            }")`,
          );
        }
      }
    }
  }

  return { catalog, hash, byId, byAlias };
}

/** `unit` should already be normalized with `normalizeUnit`. */
export function lookup(
  index: CatalogIndex,
  query: { name: string; specimen: Specimen | null; unit: string | null },
): Match {
  const candidates = index.byAlias.get(nameKey(query.name)) ?? [];
  if (candidates.length === 0) {
    return {
      kind: "unmapped",
      reason: `"${query.name}" is not in the catalog`,
    };
  }

  const sameSpecimen = query.specimen
    ? candidates.filter((a) => a.specimen === query.specimen)
    : candidates;
  if (sameSpecimen.length === 0) {
    const known = [...new Set(candidates.map((a) => a.specimen))].join("/");
    return {
      kind: "unmapped",
      reason:
        `catalog knows "${query.name}" only as a ${known} test, not ${query.specimen}`,
    };
  }

  const key = unitKey(query.unit);
  const fits = sameSpecimen.filter((a) => a.factors.has(key));
  if (fits.length === 1) {
    return {
      kind: "mapped",
      analyte: fits[0],
      factor: fits[0].factors.get(key)!,
    };
  }
  if (fits.length > 1) {
    return {
      kind: "unmapped",
      reason: `ambiguous without a specimen: ${
        fits.map((a) => a.id).join(", ")
      }`,
    };
  }
  return {
    kind: "unmapped",
    reason: `unit "${query.unit ?? "none"}" is not accepted by ${
      sameSpecimen.map((a) => a.id).join(", ")
    }`,
  };
}

/**
 * Validates and indexes catalog JSON. The hash is taken over the JSON content,
 * not the file's text, so the CLI (reading the file) and the desktop app
 * (importing it as a module) record the same hash for the same catalog.
 */
export async function catalogFromJson(
  json: unknown,
  source = "catalog",
): Promise<CatalogIndex> {
  const parsed = CatalogSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`${source} is invalid: ${issues}`);
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(json)),
  );
  return indexCatalog(
    parsed.data,
    encodeHex(new Uint8Array(digest)).slice(0, 12),
  );
}

export async function loadCatalog(
  path = DEFAULT_CATALOG,
): Promise<CatalogIndex> {
  const text = await Deno.readTextFile(path);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new Error(
      `catalog ${path} is not valid JSON: ${
        cause instanceof Error ? cause.message : cause
      }`,
    );
  }
  return await catalogFromJson(json, `catalog ${path}`);
}

/** One analyte per block, arrays inline, so the file stays easy to edit by hand. */
export function formatCatalog(catalog: Catalog): string {
  const json = JSON.stringify;
  const blocks = catalog.analytes.map((a) =>
    [
      "    {",
      `      "id": ${json(a.id)}, "name": ${json(a.name)}, "specimen": ${
        json(a.specimen)
      }, "unit": ${json(a.unit)},`,
      `      "aliases": [${a.aliases.map((alias) => json(alias)).join(", ")}],`,
      `      "units": { ${
        Object.entries(a.units)
          .map(([unit, factor]) => `${json(unit)}: ${factor}`)
          .join(", ")
      } }`,
      "    }",
    ].join("\n")
  );
  return `{\n  "analytes": [\n${blocks.join(",\n")}\n  ]\n}\n`;
}
