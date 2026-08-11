/**
 * `jolly-input` streams edits; `jolly-change` fires on commit.
 */
export interface JollyChangeDetail<TValue> {
  value: TValue;
}

export type JollyFieldEventName = "jolly-input" | "jolly-change";

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
