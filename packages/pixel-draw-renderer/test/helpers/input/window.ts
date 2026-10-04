// Import Internal Dependencies
import type { WindowLike } from "#src/input/WindowLike.ts";

type Listener = (event: any) => void;

export class FakeWindow implements WindowLike {
  #listeners = new Map<string, Set<Listener>>();

  addEventListener(
    type: string,
    listener: Listener
  ): void {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(
        type,
        listeners
      );
    }
    listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: Listener
  ): void {
    this.#listeners.get(
      type
    )?.delete(listener);
  }

  dispatch(
    type: string,
    event: unknown = {}
  ): void {
    const listeners = this.#listeners.get(type) ?? [];
    for (const listener of listeners) {
      listener(event);
    }
  }
}
