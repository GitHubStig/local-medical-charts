/**
 * The analyte catalog as the app sees it: display name, group and standard unit
 * for each analyte id. Imported straight from src/analytes.json, so a catalog
 * edit regroups or renames cards without touching stored reports.
 */
import catalog from "../../../src/analytes.json" with { type: "json" };
import type { AnalyteGroup } from "../../../src/analyte-groups.ts";
import { unitKey } from "../../../src/units.ts";

export type AnalyteInfo = {
  id: string;
  name: string;
  group: AnalyteGroup;
  /** Standard unit; "" when dimensionless. */
  unit: string;
  aliases: readonly string[];
  /** Position in the catalog, which orders cards within a group. */
  order: number;
  /** Accepted printed unit, as a unitKey, → factor that converts into `unit`. */
  factors: ReadonlyMap<string, number>;
};

export const ANALYTES: ReadonlyMap<string, AnalyteInfo> = new Map(
  catalog.analytes.map((a, order) => [a.id, {
    id: a.id,
    name: a.name,
    group: a.group as AnalyteGroup,
    unit: a.unit,
    aliases: a.aliases,
    order,
    // JSON imports type each entry's units separately, so check each factor.
    factors: new Map(
      Object.entries(a.units).flatMap(([unit, factor]) =>
        typeof factor === "number" ? [[unitKey(unit), factor] as const] : []
      ),
    ),
  }]),
);

/**
 * The factor that converts a value printed in `unit` into the analyte's
 * standard unit, as the pipeline converted it; null when the catalog doesn't
 * list that unit.
 */
export function unitFactor(
  analyteId: string,
  unit: string | null,
): number | null {
  return ANALYTES.get(analyteId)?.factors.get(unitKey(unit)) ?? null;
}
