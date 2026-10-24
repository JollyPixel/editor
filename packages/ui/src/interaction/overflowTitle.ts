// Import Internal Dependencies
import { composedClosest } from "../dom.ts";

// CONSTANTS
const kOverflowTitleAttribute = "overflow-title";

export function overflowTitleEnabled(
  element: Element
): boolean {
  return composedClosest(element, `[${kOverflowTitleAttribute}]`)
    ?.getAttribute(kOverflowTitleAttribute) !== "off";
}

function isTextTruncated(
  element: Element
): boolean {
  return element.scrollWidth > element.clientWidth;
}

export function syncOverflowTitle(
  element: HTMLElement
): void {
  const text = element.textContent?.trim() ?? "";
  if (
    text !== "" &&
    isTextTruncated(element) &&
    overflowTitleEnabled(element)
  ) {
    element.title = text;
  }
  else {
    element.removeAttribute("title");
  }
}

export function revealOverflowTitle(
  event: Event
): void {
  if (event.currentTarget instanceof HTMLElement) {
    syncOverflowTitle(event.currentTarget);
  }
}
