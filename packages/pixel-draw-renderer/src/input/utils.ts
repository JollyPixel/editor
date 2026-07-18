// CONSTANTS
const kEditableInputTypes = new Set([
  "text", "search", "email", "url", "tel", "password", "number",
  "date", "datetime-local", "month", "time", "week"
]);

/**
 * Prevents Shift from being reported while the user is typing in toolbar
 * UI (e.g. a brush-size field) elsewhere in the page. Only text-entry
 * inputs count as "typing" — a range/color input left focused after a drag
 * (canvas has no tabindex, so clicking it can't steal focus back) must not
 * keep swallowing Shift.
 */
export function isEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.tagName === "TEXTAREA") {
    return true;
  }

  return target.tagName === "INPUT" && kEditableInputTypes.has(
    (target as HTMLInputElement).type
  );
}
