// CONSTANTS
const kEditableInputTypes = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week"
]);

/**
 * Ignores text entry without treating focused range or color inputs as typing.
 */
export function isEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.isContentEditable ||
    target.tagName === "TEXTAREA"
  ) {
    return true;
  }

  return isHTMLInputElement(target) ?
    kEditableInputTypes.has(target.type) :
    false;
}

function isHTMLInputElement(
  element: HTMLElement | null
): element is HTMLInputElement {
  return element?.tagName === "INPUT";
}
