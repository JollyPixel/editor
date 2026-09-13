export function emitComposedEvent<TDetail>(
  target: EventTarget,
  name: string,
  detail: TDetail
): void {
  target.dispatchEvent(
    new CustomEvent<TDetail>(name, {
      detail,
      bubbles: true,
      composed: true
    })
  );
}
