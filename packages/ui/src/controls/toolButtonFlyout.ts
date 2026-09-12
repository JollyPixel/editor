// CONSTANTS
const kActionTags = new Set([
  "BUTTON",
  "JOLLY-BUTTON",
  "JOLLY-TOOL-BUTTON"
]);

export function isFlyoutAction(
  path: Iterable<EventTarget>,
  flyout: EventTarget
): boolean {
  for (const target of path) {
    if (target === flyout) {
      return false;
    }
    if (
      isElement(target) &&
      kActionTags.has(target.tagName) &&
      !target.hasAttribute("disabled")
    ) {
      return true;
    }
  }

  return false;
}

export function opensOnClick(
  pointerType: string
): boolean {
  return pointerType !== "mouse";
}

function isElement(
  target: EventTarget
): target is Element {
  return typeof Reflect.get(target, "tagName") === "string";
}
