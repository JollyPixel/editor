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

/**
 * Narrows a custom event to its detail.
 */
export function detailOf<TDetail>(
  event: Event
): TDetail | null {
  return event instanceof CustomEvent ? event.detail : null;
}
