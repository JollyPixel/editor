// Import Internal Dependencies
import type { PresenceSource } from "./PresenceSource.ts";

export const kPresenceRequestEvent = "jolly-presence-request";

export type PresenceListener = (
  source: PresenceSource | null
) => void;

export interface PresenceRequestDetail {
  /** Filled in by the nearest ancestor holding a source. */
  source: PresenceSource | null;
  /**
   * Subscribes when a pane receives its source after a field connects.
   */
  subscribe: ((listener: PresenceListener) => () => void) | null;
}

export interface PresenceProvider {
  /** Pushes the current source to every registered descendant. */
  notify(): void;
  dispose(): void;
}

/**
 * Requests the nearest source across shadow roots without `@lit/context`.
 */
export function requestPresenceSource(
  element: HTMLElement
): PresenceRequestDetail {
  const detail: PresenceRequestDetail = {
    source: null,
    subscribe: null
  };
  element.dispatchEvent(
    new CustomEvent<PresenceRequestDetail>(kPresenceRequestEvent, {
      detail,
      bubbles: true,
      composed: true
    })
  );

  return detail;
}

export function providePresenceSource(
  element: HTMLElement,
  read: () => PresenceSource | null
): PresenceProvider {
  const listeners = new Set<PresenceListener>();

  function listener(
    event: Event
  ): void {
    const { detail } = event as CustomEvent<PresenceRequestDetail>;
    detail.source = read();
    detail.subscribe = (subscriber) => {
      listeners.add(subscriber);

      return () => listeners.delete(subscriber);
    };
    event.stopPropagation();
  }

  element.addEventListener(kPresenceRequestEvent, listener);

  return {
    notify() {
      const source = read();
      for (const subscriber of listeners) {
        subscriber(source);
      }
    },
    dispose() {
      element.removeEventListener(kPresenceRequestEvent, listener);
      listeners.clear();
    }
  };
}
