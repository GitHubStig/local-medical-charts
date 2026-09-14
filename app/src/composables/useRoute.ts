/**
 * The screen named in the address's #fragment. Links set it (href="#/settings"),
 * so back and reload behave as on any page.
 */
import { readonly, ref } from "vue";
import { parseRoute, type Route } from "../lib/route.ts";

const route = ref<Route>(parseRoute(location.hash));

addEventListener("hashchange", () => {
  route.value = parseRoute(location.hash);
  // A new screen starts at its top, not wherever the last one was scrolled to.
  scrollTo(0, 0);
});

export function useRoute() {
  return { route: readonly(route) };
}
