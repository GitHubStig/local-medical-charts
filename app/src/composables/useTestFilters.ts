/**
 * The test grid's search and flagged-only filter. Held outside the component so
 * they survive switching patients, when the dashboard briefly unmounts while the
 * next patient's data loads.
 */
import { ref } from "vue";

const query = ref("");
const flaggedOnly = ref(false);

export function useTestFilters() {
  return {
    query,
    flaggedOnly,
    clear() {
      query.value = "";
      flaggedOnly.value = false;
    },
  };
}
