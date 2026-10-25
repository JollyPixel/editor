// Import Node.js Dependencies
import type { TestContext } from "node:test";

// CONSTANTS
const kFrameMs = 16;

export class FakeFrames {
  #next = 1;
  #time = 0;
  #pending = new Map<number, FrameRequestCallback>();

  constructor(
    t: TestContext
  ) {
    t.mock.method(
      globalThis,
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        this.#pending.set(
          this.#next,
          callback
        );

        return this.#next++;
      }
    );
    t.mock.method(
      globalThis,
      "cancelAnimationFrame",
      (id: number) => {
        this.#pending.delete(id);
      }
    );
  }

  get length(): number {
    return this.#pending.size;
  }

  run(
    elapsedMs = kFrameMs
  ): void {
    const callbacks = [
      ...this.#pending.values()
    ];
    this.#pending.clear();
    this.#time += elapsedMs;
    for (const callback of callbacks) {
      callback(this.#time);
    }
  }
}
