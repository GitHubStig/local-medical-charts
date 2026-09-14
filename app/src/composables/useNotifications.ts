/**
 * Whether a system notification is shown when a reading finishes while the app
 * is behind. Saved through the settings bindings, like the chart library. The
 * desktop side sends the notifications; the browser fake never does.
 */
import { readonly, ref } from "vue";
import type { DesktopBindings, Settings } from "../../../desktop/contract.ts";
import { errorMessage } from "../api/index.ts";

const notifyWhenRead = ref(true);
const saveError = ref<string | null>(null);
let bindings: DesktopBindings | null = null;

/** Call once the bindings are connected, with the settings already loaded. */
export function initNotifications(
  connected: DesktopBindings,
  settings: Settings,
): void {
  bindings = connected;
  notifyWhenRead.value = settings.notifyWhenRead;
}

export function useNotifications() {
  async function setNotifyWhenRead(next: boolean) {
    const previous = notifyWhenRead.value;
    notifyWhenRead.value = next; // move the switch now; undo if saving fails
    saveError.value = null;
    if (!bindings) return;
    try {
      notifyWhenRead.value =
        (await bindings.updateSettings({ notifyWhenRead: next }))
          .notifyWhenRead;
    } catch (err) {
      notifyWhenRead.value = previous;
      saveError.value = errorMessage(err);
    }
  }

  return {
    notifyWhenRead: readonly(notifyWhenRead),
    saveError: readonly(saveError),
    setNotifyWhenRead,
  };
}
