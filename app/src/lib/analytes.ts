/**
 * The analyte catalog as the app sees it: display name, group and standard unit
 * for each analyte id. Imported straight from src/analytes.json, so a catalog
 * edit regroups or renames cards without touching stored reports.
 */
import catalog from "../../../src/analytes.json" with { type: "json" };
import type { AnalyteGroup } from "../../../src/analyte-groups.ts";

export type AnalyteInfo = {
  id: string;
  name: string;
  group: AnalyteGroup;
  /** Standard unit; "" when dimensionless. */
  unit: string;
  aliases: readonly string[];
  /** Position in the catalog, which orders cards within a group. */
  order: number;
};

export const ANALYTES: ReadonlyMap<string, AnalyteInfo> = new Map(
  catalog.analytes.map((a, order) => [a.id, {
    id: a.id,
    name: a.name,
    group: a.group as AnalyteGroup,
    unit: a.unit,
    aliases: a.aliases,
    order,
  }]),
);
