import { assertEquals } from "@std/assert";
import { closeOnEscape } from "../app/src/lib/dialog-keys.ts";

/** A key press and a dialog that both record what was done to them. */
function press(key: string, modifiers: Record<string, boolean> = {}) {
  const done = { prevented: false, closed: false };
  const event = {
    key,
    ...modifiers,
    preventDefault: () => {
      done.prevented = true;
    },
  };
  const dialog = {
    close: () => {
      done.closed = true;
    },
  };
  return { took: closeOnEscape(event, dialog), ...done };
}

Deno.test("Esc closes the dialog, and the key counts as used", () => {
  assertEquals(press("Escape"), { took: true, prevented: true, closed: true });
});

Deno.test("other keys are left to the dialog and the page", () => {
  for (const key of ["ArrowLeft", "Enter", "Tab", "e"]) {
    assertEquals(
      press(key),
      { took: false, prevented: false, closed: false },
      key,
    );
  }
});

Deno.test("Esc held with a modifier isn't the dialog's", () => {
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) {
    assertEquals(
      press("Escape", { [modifier]: true }),
      { took: false, prevented: false, closed: false },
      modifier,
    );
  }
});

Deno.test("a dialog that has already gone doesn't stop the key being used", () => {
  const event = { key: "Escape", preventDefault: () => {} };
  assertEquals(closeOnEscape(event, null), true);
});
