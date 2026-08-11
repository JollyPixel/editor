/**
 * Narrows an event target to an input element.
 */
export function isInputElement(
  target: EventTarget | null
): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}

export function isSelectElement(
  target: EventTarget | null
): target is HTMLSelectElement {
  return target instanceof HTMLSelectElement;
}

export function isButtonElement(
  target: EventTarget | null
): target is HTMLButtonElement {
  return target instanceof HTMLButtonElement;
}

export function isSlotElement(
  target: EventTarget | null
): target is HTMLSlotElement {
  return target instanceof HTMLSlotElement;
}

export function isDocumentOrShadowRoot(
  node: Node
): node is Document | ShadowRoot {
  return node instanceof Document || node instanceof ShadowRoot;
}

/**
 * Narrows a custom event to its detail.
 */
export function detailOf<TDetail>(
  event: Event
): TDetail | null {
  return event instanceof CustomEvent ? event.detail : null;
}
