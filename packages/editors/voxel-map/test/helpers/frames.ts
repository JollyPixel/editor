// Import Node.js Dependencies
import type { TestContext } from "node:test";

export class FakeFrames {
  #next = 1;
  #pending = new Map<number, FrameRequestCallback>();

  constructor(
    t: TestContext
  ) {
    const { requestAnimationFrame, cancelAnimationFrame } = globalThis;
    globalThis.requestAnimationFrame = (callback) => {
      this.#pending.set(this.#next, callback);

      return this.#next++;
    };
    globalThis.cancelAnimationFrame = (id) => {
      this.#pending.delete(id);
    };
    t.after(() => {
      globalThis.requestAnimationFrame = requestAnimationFrame;
      globalThis.cancelAnimationFrame = cancelAnimationFrame;
    });
  }

  get length(): number {
    return this.#pending.size;
  }

  run(): void {
    const callbacks = [...this.#pending.values()];
    this.#pending.clear();
    for (const callback of callbacks) {
      callback(0);
    }
  }
}
