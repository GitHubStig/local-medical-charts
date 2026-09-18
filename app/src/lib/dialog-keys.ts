/**
 * Esc on a native dialog.
 *
 * Closing on Esc is the dialog's own behaviour, but macOS WebKit doesn't count
 * the key as used: it hands it to the window around the page, which rings the
 * system bell. So the desktop window beeps while closing the dialog, as though
 * nothing had happened. Closing from the page instead keeps exactly what the
 * platform does and marks the key handled, which leaves the bell for the keys
 * that really do nothing.
 */

/** A key press as a keydown handler gets it; Deno's type check has no KeyboardEvent. */
type KeyPress = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  preventDefault(): void;
};

/** Closes the dialog on a plain Esc. True when it took the key. */
export function closeOnEscape(
  press: KeyPress,
  dialog: { close(): void } | null | undefined,
): boolean {
  if (press.key !== "Escape") return false;
  if (press.altKey || press.ctrlKey || press.metaKey || press.shiftKey) {
    return false;
  }
  press.preventDefault();
  dialog?.close();
  return true;
}
