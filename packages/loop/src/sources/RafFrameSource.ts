// Import Internal Dependencies
import type {
  FrameCallback,
  FrameSource
} from "../FrameSource.ts";

export interface RafFrameSourceOptions {
  /**
   * Defaults to `globalThis.requestAnimationFrame`.
   */
  requestAnimationFrame?: (
    callback: (now: number) => void
  ) => number;
  /**
   * Defaults to `globalThis.cancelAnimationFrame`.
   */
  cancelAnimationFrame?: (
    handle: number
  ) => void;
}

/**
 * Browser frame source with injectable animation-frame functions.
 */
export class RafFrameSource implements FrameSource {
  #request: (callback: (now: number) => void) => number;
  #cancel: (handle: number) => void;
  #handle: number | null = null;

  constructor(
    options: RafFrameSourceOptions = {}
  ) {
    const {
      requestAnimationFrame: request = globalThis.requestAnimationFrame,
      cancelAnimationFrame: cancel = globalThis.cancelAnimationFrame
    } = options;

    if (
      typeof request !== "function" ||
      typeof cancel !== "function"
    ) {
      throw new TypeError(
        "requestAnimationFrame is unavailable, pass one through options"
      );
    }
    this.#request = request.bind(globalThis);
    this.#cancel = cancel.bind(globalThis);
  }

  get running(): boolean {
    return this.#handle !== null;
  }

  start(
    callback: FrameCallback
  ): void {
    this.stop();

    const tick = (now: number) => {
      // Schedule first so a throwing callback only interrupts one frame.
      this.#handle = this.#request(tick);
      callback(now);
    };
    this.#handle = this.#request(tick);
  }

  stop(): void {
    if (this.#handle === null) {
      return;
    }

    this.#cancel(this.#handle);
    this.#handle = null;
  }
}
