/**
 * Which foldable regions are open, per patient, for as long as the app is open.
 * Held outside the components, so it survives switching patients and visiting
 * Settings or a review, when the dashboard unmounts.
 */
import { reactive } from "vue";
import { type FoldRegion, isFoldOpen, rememberFold } from "../lib/folds.ts";

const memory = reactive(new Map<string, boolean>());

export function useFolds() {
  return {
    isOpen: (patientId: number, region: FoldRegion, byDefault: boolean) =>
      isFoldOpen(memory, patientId, region, byDefault),
    setOpen: (patientId: number, region: FoldRegion, open: boolean) =>
      rememberFold(memory, patientId, region, open),
  };
}

/** Forgets every patient's regions, e.g. after Clear all data, when patient numbers can be reused. */
export function forgetFolds(): void {
  memory.clear();
}
