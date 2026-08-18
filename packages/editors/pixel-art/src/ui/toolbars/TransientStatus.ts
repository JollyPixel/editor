// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// CONSTANTS
const kStatusTimeoutMs = 3_000;

/**
 * A status message that clears itself after kStatusTimeoutMs, used by
 * toolbar controllers that flash a transient result (clipboard, drop) to
 * the user.
 */
export class TransientStatus {
  #host: ReactiveControllerHost;
  #value = "";
  #timer: number | null = null;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
  }

  get value(): string {
    return this.#value;
  }

  set(
    message: string
  ): void {
    this.#clearTimer();
    this.#value = message;
    this.#timer = window.setTimeout(
      () => this.clear(),
      kStatusTimeoutMs
    );
    this.#host.requestUpdate();
  }

  clear(): void {
    this.#clearTimer();
    if (!this.#value) {
      return;
    }

    this.#value = "";
    this.#host.requestUpdate();
  }

  #clearTimer(): void {
    if (this.#timer === null) {
      return;
    }

    window.clearTimeout(this.#timer);
    this.#timer = null;
  }
}
