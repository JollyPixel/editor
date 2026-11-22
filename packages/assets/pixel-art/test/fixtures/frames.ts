// Import Node.js Dependencies
import type { TestContext } from "node:test";

export class FakeFrames {
  #next = 1;
  #pending = new Map<number, () => void>();

  constructor(
    t: TestContext
  ) {
    const descriptors = {
      requestAnimationFrame: Object.getOwnPropertyDescriptor(
        globalThis,
        "requestAnimationFrame"
      ),
      cancelAnimationFrame: Object.getOwnPropertyDescriptor(
        globalThis,
        "cancelAnimationFrame"
      )
    };
    Object.assign(globalThis, {
      requestAnimationFrame: (callback: () => void) => {
        this.#pending.set(this.#next, callback);

        return this.#next++;
      },
      cancelAnimationFrame: (id: number) => {
        this.#pending.delete(id);
      }
    });
    t.after(() => {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor === undefined) {
          Reflect.deleteProperty(
            globalThis,
            key
          );
        }
        else {
          Object.defineProperty(
            globalThis,
            key,
            descriptor
          );
        }
      }
    });
  }

  run(): void {
    const callbacks = [...this.#pending.values()];
    this.#pending.clear();
    for (const callback of callbacks) {
      callback();
    }
  }
}
