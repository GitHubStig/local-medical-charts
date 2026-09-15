/**
 * Which foldable regions of each patient's dashboard are open. Remembered per
 * patient, so switching patients, or visiting Settings or a review and coming
 * back, finds every region as it was left. Plain functions over a Map, so they
 * can be tested without Vue (useFolds holds the Map).
 */

/** Reports, Tests and Text results; a report row; a report's interpretation or extraction notes. */
export type FoldRegion =
  | "reports"
  | "tests"
  | "text"
  | `report:${number}`
  | `report:${number}:interpretation`
  | `report:${number}:notes`;

export function reportRegion(
  reportId: number,
  part?: "interpretation" | "notes",
): FoldRegion {
  return part ? `report:${reportId}:${part}` : `report:${reportId}`;
}

const key = (patientId: number, region: FoldRegion) => `${patientId}/${region}`;

/** Whether a region is open: as it was left, or `byDefault` if it hasn't been touched. */
export function isFoldOpen(
  memory: ReadonlyMap<string, boolean>,
  patientId: number,
  region: FoldRegion,
  byDefault: boolean,
): boolean {
  return memory.get(key(patientId, region)) ?? byDefault;
}

export function rememberFold(
  memory: Map<string, boolean>,
  patientId: number,
  region: FoldRegion,
  open: boolean,
): void {
  memory.set(key(patientId, region), open);
}
