// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GameLoop,
  ManualFrameSource,
  suspendWhenHidden
} from "../src/index.ts";

// CONSTANTS
const kTarget = Object.create(null) as Element;

type VisibilityCallback = (
  entries: Array<{ isIntersecting: boolean; }>
) => void;

function stubVisibility(
  context: TestContext
) {
  let notify: VisibilityCallback | null = null;
  let disconnected = false;

  class FakeIntersectionObserver {
    readonly observe = () => undefined;

    constructor(
      callback: VisibilityCallback
    ) {
      notify = callback;
    }

    disconnect(): void {
      disconnected = true;
    }
  }

  const original = globalThis.IntersectionObserver;
  Object.assign(globalThis, {
    IntersectionObserver: FakeIntersectionObserver
  });
  context.after(() => {
    Object.assign(globalThis, {
      IntersectionObserver: original
    });
  });

  return {
    show: (visible: boolean) => notify?.([{ isIntersecting: visible }]),
    get disconnected() {
      return disconnected;
    }
  };
}

describe("Loop.suspendWhenHidden", () => {
  test("stops the loop while hidden and restarts it once visible", (context) => {
    const source = new ManualFrameSource();
    const loop = new GameLoop({ source });
    const visibility = stubVisibility(context);
    const session = new AbortController();
    loop.start({});

    suspendWhenHidden(loop, kTarget, session.signal);
    visibility.show(false);
    assert.equal(loop.running, false);
    assert.equal(source.running, false);

    visibility.show(true);
    assert.equal(loop.running, true);
    assert.equal(source.running, true);

    session.abort();
    assert.equal(visibility.disconnected, true);
  });

  test("never starts a loop that was stopped by its owner", (context) => {
    const loop = new GameLoop({ source: new ManualFrameSource() });
    const visibility = stubVisibility(context);

    suspendWhenHidden(loop, kTarget, new AbortController().signal);
    visibility.show(true);

    assert.equal(loop.running, false);
  });

  test("leaves a loop restarted by its owner while hidden alone", (context) => {
    const loop = new GameLoop({ source: new ManualFrameSource() });
    const visibility = stubVisibility(context);
    loop.start({});

    suspendWhenHidden(loop, kTarget, new AbortController().signal);
    visibility.show(false);
    loop.start();

    assert.doesNotThrow(() => visibility.show(true));
    assert.equal(loop.running, true);
  });

  test("stops tracking loop restarts once aborted", (context) => {
    const loop = new GameLoop({ source: new ManualFrameSource() });
    stubVisibility(context);
    const session = new AbortController();

    suspendWhenHidden(loop, kTarget, session.signal);
    session.abort();

    assert.equal(loop.listenerCount("start"), 0);
  });
});
