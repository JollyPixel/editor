// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { DockSlot } from "#src/panel/DockSlot.ts";

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

function createSlot(): { slot: DockSlot; host: TestHost; changes: () => number; } {
  const host = new TestHost();
  let changes = 0;
  const slot = new DockSlot(host, () => changes++);

  return {
    slot,
    host,
    changes: () => changes
  };
}

describe("DockSlot", () => {
  test("starts with every dock closed", () => {
    const { slot } = createSlot();

    assert.equal(slot.isOpen("color"), false);
    assert.equal(slot.isOpen("normal-map"), false);
  });

  test("opening a dock closes the other one", () => {
    const { slot } = createSlot();

    slot.show("color");
    slot.show("normal-map");

    assert.equal(slot.isOpen("color"), false);
    assert.equal(slot.isOpen("normal-map"), true);
  });

  test("hide only closes the named dock", () => {
    const { slot } = createSlot();
    slot.show("normal-map");

    slot.hide("color");

    assert.equal(slot.isOpen("normal-map"), true);
  });

  test("toggle flips a dock, or forces it", () => {
    const { slot } = createSlot();

    slot.toggle("color");
    assert.equal(slot.isOpen("color"), true);

    slot.toggle("color");
    assert.equal(slot.isOpen("color"), false);

    slot.toggle("color", false);
    assert.equal(slot.isOpen("color"), false);

    slot.toggle("color", true);
    assert.equal(slot.isOpen("color"), true);
  });

  test("notifies and updates the host only on a change", () => {
    const { slot, host, changes } = createSlot();

    slot.show("color");
    slot.show("color");
    slot.hide("normal-map");

    assert.equal(changes(), 1);
    assert.equal(host.updateCount, 1);
  });
});
