/**
 * The app's colour theme: "system" follows the operating system, or the viewer
 * picks light or dark. The choice is saved through the settings bindings.
 *
 * The resolved theme is written to <html data-theme>, which style.css uses to
 * swap every colour token at once.
 */
import { usePreferredDark } from "@vueuse/core";
import { computed, readonly, ref, watchEffect } from "vue";
import type {
  DesktopBindings,
  Settings,
  Theme,
} from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";

const theme = ref<Theme>("system");
const saveError = ref<string | null>(null);
const prefersDark = usePreferredDark();
const resolved = computed<"light" | "dark">(() =>
  theme.value === "system"
    ? (prefersDark.value ? "dark" : "light")
    : theme.value
);
let bindings: DesktopBindings | null = null;

watchEffect(() => {
  document.documentElement.dataset.theme = resolved.value;
  document.documentElement.style.colorScheme = resolved.value;
});

/**
 * Call once the bindings are connected: applies the saved theme. Pass settings
 * already loaded to avoid fetching them twice.
 */
export async function initTheme(
  connected: DesktopBindings,
  settings?: Settings,
): Promise<void> {
  bindings = connected;
  try {
    theme.value = (settings ?? await connected.getSettings()).theme;
  } catch (err) {
    saveError.value = errorMessage(err);
  }
}

export function useTheme() {
  async function setTheme(next: Theme) {
    const previous = theme.value;
    theme.value = next; // apply immediately; undo if saving fails
    saveError.value = null;
    if (!bindings) return;
    try {
      theme.value = (await bindings.updateSettings({ theme: next })).theme;
    } catch (err) {
      theme.value = previous;
      saveError.value = errorMessage(err);
    }
  }

  return {
    theme: readonly(theme),
    resolved,
    saveError: readonly(saveError),
    setTheme,
  };
}
