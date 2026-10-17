// Import Internal Dependencies
import { emitComposedEvent } from "../events.ts";

export interface JollyChangeDetail<TValue> {
  value: TValue;
}

export type JollyFieldEventName = "jolly-input" | "jolly-change";

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
  emitComposedEvent<JollyChangeDetail<TValue>>(target, name, {
    value
  });
}
