// Import Internal Dependencies
import { emitComposedEvent } from "../../events.ts";
import type { FieldLockSource } from "./FieldLockSource.ts";

// CONSTANTS
const kFieldLocksRequestEvent = "jolly-field-locks-request";

export type FieldLocksListener = (
  source: FieldLockSource | null
) => void;

interface FieldLocksRequest {
  source: FieldLockSource | null;
  subscribe: ((listener: FieldLocksListener) => () => void) | null;
}

export interface FieldLocksProvider {
  notify(): void;
  dispose(): void;
}

export function requestFieldLocks(
  element: HTMLElement
): FieldLocksRequest {
  const detail: FieldLocksRequest = {
    source: null,
    subscribe: null
  };
  emitComposedEvent(element, kFieldLocksRequestEvent, detail);

  return detail;
}

export function provideFieldLocks(
  element: HTMLElement,
  read: () => FieldLockSource | null
): FieldLocksProvider {
  const listeners = new Set<FieldLocksListener>();

  function listener(
    event: Event
  ): void {
    const { detail } = event as CustomEvent<FieldLocksRequest>;
    detail.source = read();
    detail.subscribe = (subscriber) => {
      listeners.add(subscriber);

      return () => listeners.delete(subscriber);
    };
    event.stopPropagation();
  }

  element.addEventListener(kFieldLocksRequestEvent, listener);

  return {
    notify() {
      const source = read();
      for (const subscriber of listeners) {
        subscriber(source);
      }
    },
    dispose() {
      element.removeEventListener(kFieldLocksRequestEvent, listener);
      listeners.clear();
    }
  };
}
