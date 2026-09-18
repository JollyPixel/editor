// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { Keyboard } from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  BrushStore,
  SelectionStore
} from "../../../../src/app/state/index.ts";
import {
  BrushShortcuts
} from "../../../../src/features/painting/interaction/BrushShortcuts.ts";

function setup() {
  const keyboard = new Keyboard();
  const brush = new BrushStore();
  const selection = new SelectionStore();
  selection.current = {
    kind: "voxel-layer",
    name: "Ground"
  };
  const shortcuts = new BrushShortcuts({
    keyboard,
    brush,
    selection
  });

  function press(
    init: KeyboardEventInit = {}
  ): void {
    keyboard.emit("KeyG", new KeyboardEvent("keydown", {
      code: "KeyG",
      ...init
    }));
  }

  return {
    brush,
    shortcuts,
    press
  };
}

describe("BrushShortcuts ghost block", () => {
  test("G toggles the ghost block", () => {
    const { brush, press } = setup();

    press();
    assert.strictEqual(brush.ghost, true);

    press();
    assert.strictEqual(brush.ghost, false);
  });

  test("a held G does not toggle again", () => {
    const { brush, press } = setup();

    press();
    press({ repeat: true });

    assert.strictEqual(brush.ghost, true);
  });

  test("G is ignored with a modifier", () => {
    const { brush, press } = setup();

    press({ ctrlKey: true });

    assert.strictEqual(brush.ghost, false);
  });

  test("dispose releases the key", () => {
    const { brush, shortcuts, press } = setup();

    shortcuts.dispose();
    press();

    assert.strictEqual(brush.ghost, false);
  });
});
