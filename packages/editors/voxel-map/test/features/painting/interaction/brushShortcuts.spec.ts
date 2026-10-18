// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { KeyBindings } from "@jolly-pixel/controls";
import {
  VoxelRotation,
  type VoxelRotationStep
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { SelectionStore, VoxelLayerRef } from "../../../../src/state/index.ts";
import { BrushStore } from "../../../../src/state/BrushStore.ts";
import {
  brushResizeShortcuts,
  brushShortcuts
} from "../../../../src/features/painting/interaction/brushShortcuts.ts";
import { defaultKeyBindings } from "../../../helpers/shortcuts.ts";

function setup(
  previewRotation: VoxelRotationStep = VoxelRotation.None
) {
  const keyboard = new KeyBindings();
  const brush = new BrushStore();
  const selection = new SelectionStore();
  selection.current = new VoxelLayerRef("Ground");
  const keyBindings = defaultKeyBindings();
  const releases = [
    keyBindings.bind(keyboard, brushShortcuts({
      brush,
      selection,
      rotation: () => (
        brush.rotationMode === "auto" ? previewRotation : brush.rotationMode
      )
    })),
    keyBindings.bind(keyboard, brushResizeShortcuts({
      brush,
      selection
    }), { repeat: true })
  ];

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
    release: () => {
      for (const release of releases) {
        release();
      }
    },
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

describe("BrushShortcuts size", () => {
  test("a held ] or [ keeps resizing the brush", () => {
    const { brush, press } = setup();

    press({ code: "BracketRight", key: "]" });
    press({ code: "BracketRight", key: "]", repeat: true });
    press({ code: "BracketRight", key: "]", repeat: true });
    assert.strictEqual(brush.size, 4);

    press({ code: "BracketLeft", key: "[", repeat: true });
    assert.strictEqual(brush.size, 3);
  });
});

describe("BrushShortcuts orientation", () => {
  test("Q and E start from the rotation the preview shows in auto", () => {
    const { brush, press } = setup(VoxelRotation.Deg180);

    press({ code: "KeyQ", key: "q" });
    assert.equal(brush.rotationMode, VoxelRotation.CW90);

    press({ code: "KeyE", key: "e" });
    press({ code: "KeyE", key: "e" });
    assert.equal(brush.rotationMode, VoxelRotation.CCW90);
  });

  test("V toggles Flip Y and T goes back to auto rotation", () => {
    const { brush, press } = setup();
    brush.rotationMode = VoxelRotation.CW90;

    press({ code: "KeyV", key: "v" });
    assert.equal(brush.flipY, true);

    press({ code: "KeyT", key: "t" });
    assert.equal(brush.rotationMode, "auto");
  });
});
