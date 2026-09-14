/**
 * Work someone is waiting on after adding reports, for the thin progress line:
 * reading the picked files and handing them to the app. One at a time; starting
 * another replaces the one before.
 */
import { readonly, shallowRef } from "vue";

export type Activity = { label: string; done: number; total: number };

const activity = shallowRef<Activity | null>(null);
let latest = 0;

/** Shows progress over `total` steps: call step() as each one finishes, and end() when done. */
export function beginActivity(label: string, total: number) {
  const id = ++latest;
  activity.value = { label, done: 0, total: Math.max(total, 1) };
  return {
    step(count = 1) {
      const now = activity.value;
      if (id !== latest || !now) return;
      activity.value = { ...now, done: Math.min(now.done + count, now.total) };
    },
    end() {
      if (id === latest) activity.value = null;
    },
  };
}

export function useActivity() {
  return { activity: readonly(activity) };
}
