export function assertElement<T extends Element>(
  element: T | null | undefined,
  message: string
): T {
  if (!element) {
    throw new Error(message);
  }

  return element;
}

export function isInputElement(
  target: EventTarget | null
): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}
