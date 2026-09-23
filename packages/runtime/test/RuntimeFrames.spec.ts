// Import Node.js Dependencies
import {
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import type { Runtime } from "../src/Runtime.ts";

// CONSTANTS
const kBrowserWindow = new Window();

let RuntimeClass: typeof import("../src/Runtime.ts").Runtime;

before(async() => {
  Object.assign(globalThis, {
    window: kBrowserWindow,
    document: kBrowserWindow.document,
    HTMLElement: kBrowserWindow.HTMLElement,
    customElements: kBrowserWindow.customElements
  });

  ({ Runtime: RuntimeClass } = await import("../src/Runtime.ts"));
});

class SteppedWorld {
  #listeners: Array<() => void> = [];

  once(
    _event: "afterUpdate",
    listener: () => void
  ): void {
    this.#listeners.push(listener);
  }

  async step(): Promise<void> {
    for (const listener of this.#listeners.splice(0)) {
      listener();
    }
    await setImmediate();
  }
}

function steppedRuntime(
  world: SteppedWorld
): Runtime {
  return Object.assign(
    Object.create(RuntimeClass.prototype),
    { world }
  ) as Runtime;
}

function track(
  promise: Promise<void>
): { settled: boolean; } {
  const state = { settled: false };
  void promise.then(() => {
    state.settled = true;
  });

  return state;
}

describe("Runtime frame stepping", () => {
  test("nextFrame resolves after the next update", async() => {
    const world = new SteppedWorld();
    const frame = track(steppedRuntime(world).nextFrame());

    await setImmediate();
    assert.equal(frame.settled, false);

    await world.step();
    assert.equal(frame.settled, true);
  });

  test("frames(n) resolves after n updates", async() => {
    const world = new SteppedWorld();
    const frames = track(steppedRuntime(world).frames(3));

    await world.step();
    await world.step();
    assert.equal(frames.settled, false);

    await world.step();
    assert.equal(frames.settled, true);
  });

  test("frames(0) resolves without an update", async() => {
    const world = new SteppedWorld();

    await steppedRuntime(world).frames(0);
  });
});
