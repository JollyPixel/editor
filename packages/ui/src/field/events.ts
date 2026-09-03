/**
 * `jolly-input` streams edits; `jolly-change` fires on commit.
 */
export interface JollyChangeDetail<TValue> {
  value: TValue;
}

export type JollyFieldEventName = "jolly-input" | "jolly-change";

/**
 * Subscribes to a field's committed value, or to every keystroke and drag
 * with `"jolly-input"`. Returns the unsubscribe.
 */
export function onFieldChange<TValue>(
  field: EventTarget,
  handler: (value: TValue) => void,
  name: JollyFieldEventName = "jolly-change"
): () => void {
  function listener(
    event: Event
  ): void {
    if (event instanceof CustomEvent) {
      const detail = event.detail as JollyChangeDetail<TValue>;
      handler(detail.value);
    }
  }
  field.addEventListener(name, listener);

  return () => field.removeEventListener(name, listener);
}

export function emitFieldEvent<TValue>(
  target: EventTarget,
  name: JollyFieldEventName,
  value: TValue
): void {
  const event = new CustomEvent<JollyChangeDetail<TValue>>(name, {
    detail: {
      value
    },
    bubbles: true,
    composed: true
  });

  target.dispatchEvent(event);
}
