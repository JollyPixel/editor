// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  ensureModalityTracking,
  wasPointerInput
} from "./pointerModality.ts";

/**
 * Tracks pointer focus so fields can suppress a spurious focus-visible ring.
 */
export class PointerFocusController {
  #host: ReactiveControllerHost;
  #active = false;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    ensureModalityTracking();
  }

  get active(): boolean {
    return this.#active;
  }

  onFocus = (): void => {
    this.#set(wasPointerInput());
  };

  onBlur = (): void => {
    this.#set(false);
  };

  /**
   * Keyboard input restores the focus-visible ring.
   */
  onKeyDown = (): void => {
    this.#set(false);
  };

  #set(
    value: boolean
  ): void {
    if (this.#active === value) {
      return;
    }

    this.#active = value;
    this.#host.requestUpdate();
  }
}
