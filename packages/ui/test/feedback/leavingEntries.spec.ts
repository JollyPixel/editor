// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import {
  LeavingEntries,
  type KeyedEntry
} from "../../src/feedback/LeavingEntries.ts";

function idleHost(): ReactiveControllerHost {
  return {
    addController() {
      return undefined;
    },
    removeController() {
      return undefined;
    },
    requestUpdate() {
      return undefined;
    },
    get updateComplete() {
      return Promise.resolve(true);
    }
  };
}

function readIds(
  entries: LeavingEntries<KeyedEntry>
): string[] {
  return entries.rendered.map((entry) => entry.id);
}

describe("LeavingEntries", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test("keeps a removed entry until its own exit transition ends", () => {
    const entries = new LeavingEntries<KeyedEntry>(idleHost());
    const row = document.createElement("div");
    const content = row.appendChild(document.createElement("span"));
    row.addEventListener("transitionend", (event) => entries.settle(event, "a"));

    entries.reconcile([{ id: "a" }]);
    entries.reconcile([{ id: "b" }]);
    assert.deepEqual(readIds(entries), ["b", "a"]);
    assert.ok(entries.isLeaving("a"));

    content.dispatchEvent(new Event("transitionend", { bubbles: true }));
    assert.deepEqual(readIds(entries), ["b", "a"]);

    row.dispatchEvent(new Event("transitionend"));
    assert.deepEqual(readIds(entries), ["b"]);
  });

  test("drops a leaving entry after a second when no transition ends", () => {
    const entries = new LeavingEntries<KeyedEntry>(idleHost());
    entries.reconcile([{ id: "a" }]);
    entries.reconcile([]);

    mock.timers.tick(999);
    assert.deepEqual(readIds(entries), ["a"]);
    mock.timers.tick(1);
    assert.deepEqual(readIds(entries), []);
  });

  test("drops leaving entries when its host disconnects", () => {
    const entries = new LeavingEntries<KeyedEntry>(idleHost());
    entries.reconcile([{ id: "a" }, { id: "b" }]);
    entries.reconcile([{ id: "b" }]);

    entries.hostDisconnected();

    assert.deepEqual(readIds(entries), ["b"]);
    assert.equal(entries.isLeaving("a"), false);
  });
});
