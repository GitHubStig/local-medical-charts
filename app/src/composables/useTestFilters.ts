/**
 * The test grid's search, flagged-only filter, and whether the Tests section is
 * open. Held outside the component so they survive switching patients, when the
 * dashboard briefly unmounts while the next patient's data loads.
 */
import { ref } from "vue";

const query = ref("");
const flaggedOnly = ref(false);
const testsOpen = ref(true);

export function useTestFilters() {
  return {
    query,
    flaggedOnly,
    testsOpen,
    clear() {
      query.value = "";
      flaggedOnly.value = false;
    },
  };
}
