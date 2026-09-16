// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { TextureBusy } from "../../src/textures/TextureBusy.ts";

class TestHost implements ReactiveControllerHost {
  readonly updateComplete = Promise.resolve(true);
  updateCount = 0;

  addController(_controller: ReactiveController): void {
    void _controller;
  }

  removeController(_controller: ReactiveController): void {
    void _controller;
  }

  requestUpdate(): void {
    this.updateCount++;
  }
}

function graceDelay(
  t: TestContext
): () => void {
  const timers = new Map<number, () => void>();
  let nextId = 0;

  t.mock.method(window, "setTimeout", (callback: () => void) => {
    nextId += 1;
    timers.set(nextId, callback);

    return nextId;
  });
  t.mock.method(window, "clearTimeout", (id: number) => {
    timers.delete(id);
  });

  return function elapse(): void {
    const pending = [...timers.values()];
    timers.clear();
    for (const callback of pending) {
      callback();
    }
  };
}

describe("TextureBusy", () => {
  test("stays invisible when the work finishes within the grace delay", (t) => {
    const elapse = graceDelay(t);
    const host = new TestHost();
    const busy = new TextureBusy(host);

    const release = busy.begin("import", "Decoding image");
    assert.equal(busy.state, null);

    release();
    elapse();
    assert.equal(busy.state, null);
    assert.equal(host.updateCount, 0);
  });

  test("paints once the work outlives the grace delay", (t) => {
    const elapse = graceDelay(t);
    const host = new TestHost();
    const busy = new TextureBusy(host);

    const release = busy.begin("drop", "Decoding image");
    elapse();
    assert.deepEqual(busy.state, {
      origin: "drop",
      label: "Decoding image"
    });
    assert.equal(host.updateCount, 1);

    release();
    assert.equal(busy.state, null);
    assert.equal(host.updateCount, 2);
  });

  test("relabels without a second delay while already visible", (t) => {
    const elapse = graceDelay(t);
    const host = new TestHost();
    const busy = new TextureBusy(host);

    busy.begin("import", "Decoding image");
    elapse();

    busy.begin("import", "Adding hero");
    assert.deepEqual(busy.state, {
      origin: "import",
      label: "Adding hero"
    });
  });

  test("ignores a release from a superseded span", (t) => {
    const elapse = graceDelay(t);
    const host = new TestHost();
    const busy = new TextureBusy(host);

    const stale = busy.begin("import", "Decoding image");
    elapse();
    busy.begin("drop", "Adding hero");

    stale();
    assert.deepEqual(busy.state, {
      origin: "drop",
      label: "Adding hero"
    });
  });

  test("drops a pending span superseded before it paints", (t) => {
    const elapse = graceDelay(t);
    const host = new TestHost();
    const busy = new TextureBusy(host);

    busy.begin("import", "Decoding image");
    busy.begin("drop", "Adding hero");
    elapse();

    assert.deepEqual(busy.state, {
      origin: "drop",
      label: "Adding hero"
    });
    assert.equal(host.updateCount, 1);
  });

  test("clear cancels a span that has not painted yet", (t) => {
    const elapse = graceDelay(t);
    const host = new TestHost();
    const busy = new TextureBusy(host);

    busy.begin("import", "Decoding image");
    busy.clear();
    elapse();

    assert.equal(busy.state, null);
    assert.equal(host.updateCount, 0);
  });
});
