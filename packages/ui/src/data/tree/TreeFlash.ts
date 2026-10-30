// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// CONSTANTS
const kFlashAnimation = "row-flash";

export class TreeFlash {
  readonly #host: ReactiveControllerHost;
  #id: string | null = null;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
  }

  flash(
    id: string
  ): void {
    this.#id = id;
    this.#host.requestUpdate();
  }

  flashing(
    id: string
  ): boolean {
    return id === this.#id;
  }

  end(
    event: AnimationEvent,
    id: string
  ): void {
    if (event.animationName === kFlashAnimation && id === this.#id) {
      this.#id = null;
      this.#host.requestUpdate();
    }
  }
}
