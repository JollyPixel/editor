// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  FrameUpdateController
} from "../../src/reactive/FrameUpdateController.ts";

interface CountingHost extends ReactiveControllerHost {
  updates: number;
}

function countingHost(): CountingHost {
  return {
    updates: 0,
    addController() {
      return undefined;
    },
    removeController() {
      return undefined;
    },
    requestUpdate() {
      this.updates++;
    },
    get updateComplete() {
      return Promise.resolve(true);
    }
  };
}

describe("FrameUpdateController", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let original: Pick<
    typeof globalThis,
    "requestAnimationFrame" | "cancelAnimationFrame"
  >;

  function runFrame(): void {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) {
      callback(0);
    }
  }

  beforeEach(() => {
    original = {
      requestAnimationFrame: globalThis.requestAnimationFrame,
      cancelAnimationFrame: globalThis.cancelAnimationFrame
    };
    globalThis.requestAnimationFrame = (callback) => {
      frames.set(++nextFrame, callback);

      return nextFrame;
    };
    globalThis.cancelAnimationFrame = (handle) => {
      frames.delete(handle);
    };
  });

  afterEach(() => {
    frames.clear();
    Object.assign(globalThis, original);
  });

  test("updates the host once per frame however often it is scheduled", () => {
    const host = countingHost();
    const frame = new FrameUpdateController(host);

    frame.schedule();
    frame.schedule();
    runFrame();
    frame.schedule();
    runFrame();

    assert.equal(host.updates, 2);
  });

  test("drops the pending update when the host disconnects", () => {
    const host = countingHost();
    const frame = new FrameUpdateController(host);

    frame.schedule();
    frame.hostDisconnected();
    runFrame();

    assert.equal(host.updates, 0);
  });
});
