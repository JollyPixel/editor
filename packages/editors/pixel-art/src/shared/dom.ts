export function isInputElement(
  target: EventTarget | null
): target is HTMLInputElement {
  return target instanceof HTMLInputElement;
}
