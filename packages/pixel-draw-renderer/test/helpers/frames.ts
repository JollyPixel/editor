// Import Node.js Dependencies
import type { TestContext } from "node:test";

export class FakeFrames {
  #next = 1;
  #pending = new Map<number, () => void>();

  constructor(
    t: TestContext
  ) {
    t.mock.method(globalThis, "requestAnimationFrame", (callback: () => void) => {
      this.#pending.set(this.#next, callback);

      return this.#next++;
    });
    t.mock.method(globalThis, "cancelAnimationFrame", (id: number) => {
      this.#pending.delete(id);
    });
  }

  get length(): number {
    return this.#pending.size;
  }

  run(): void {
    const callbacks = [...this.#pending.values()];
    this.#pending.clear();
    for (const callback of callbacks) {
      callback();
    }
  }
}
