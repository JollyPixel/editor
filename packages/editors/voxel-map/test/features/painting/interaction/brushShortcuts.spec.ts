// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { KeyBindings } from "@jolly-pixel/controls";

// Import Internal Dependencies
import { SelectionStore, VoxelLayerRef } from "../../../../src/state/index.ts";
import { BrushStore } from "../../../../src/features/painting/BrushStore.ts";
import { bindBrushShortcuts } from "../../../../src/features/painting/interaction/brushShortcuts.ts";

function setup() {
  const keyboard = new KeyBindings();
  const brush = new BrushStore();
  const selection = new SelectionStore();
  selection.current = new VoxelLayerRef("Ground");
  const release = bindBrushShortcuts({
    keyboard,
    brush,
    selection
  });

  function press(
    init: KeyboardEventInit = {}
  ): void {
    keyboard.dispatch(new KeyboardEvent("keydown", {
      code: "KeyG",
      key: "g",
      ...init
    }));
  }

  return {
    brush,
    release,
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
    const { brush, release, press } = setup();

    release();
    press();

    assert.strictEqual(brush.ghost, false);
  });
});

describe("BrushShortcuts while suspended", () => {
  test("G leaves the brush untouched", () => {
    const { brush, press } = setup();
    brush.suspended = true;

    press();

    assert.strictEqual(brush.ghost, false);
  });

  test("G works again once the brush resumes", () => {
    const { brush, press } = setup();
    brush.suspended = true;
    press();

    brush.suspended = false;
    press();

    assert.strictEqual(brush.ghost, true);
  });
});
