// CONSTANTS
const kOverflowTitleAttribute = "overflow-title";

export function overflowTitleEnabled(
  element: Element
): boolean {
  let node: Node | null = element;
  while (node !== null) {
    if (node instanceof Element) {
      const value = node.getAttribute(kOverflowTitleAttribute);
      if (value !== null) {
        return value !== "off";
      }
    }
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }

  return true;
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
