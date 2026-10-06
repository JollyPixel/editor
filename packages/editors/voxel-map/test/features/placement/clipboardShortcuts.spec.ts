// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  KeyBindings,
  isApplePlatform
} from "@jolly-pixel/controls";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { bindClipboardShortcuts } from "../../../src/features/placement/clipboardShortcuts.ts";

// CONSTANTS
const kMod: KeyboardEventInit = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };
const kAim = { x: 4, y: 1, z: -2 };

function setup(
  options: { placing?: boolean; filled?: boolean; } = {}
) {
  const { placing = false, filled = true } = options;
  const keyboard = new KeyBindings();
  const copies: number[] = [];
  const pasted: VoxelCoord[] = [];
  const release = bindClipboardShortcuts({
    keyboard,
    placement: {
      copy: () => copies.push(1) > 0 && placing,
      paste: (position) => {
        pasted.push(position);

        return filled;
      }
    },
    aimPoint: () => kAim
  });

  function press(
    letter: string,
    init: KeyboardEventInit = kMod
  ): boolean {
    return keyboard.dispatch(new KeyboardEvent("keydown", {
      cancelable: true,
      code: `Key${letter.toUpperCase()}`,
      key: letter,
      ...init
    }));
  }

  return {
    release,
    copies,
    pasted,
    press
  };
}

describe("ClipboardShortcuts", () => {
  test("copies what floats and leaves Mod+C to the browser otherwise", () => {
    const floating = setup({ placing: true });
    const idle = setup();

    assert.equal(floating.press("c"), true);
    assert.equal(idle.press("c"), false);
    assert.equal(floating.copies.length, 1);
  });

  test("pastes at the aimed cell, and only consumes Mod+V with a filled clipboard", () => {
    const filled = setup();
    const empty = setup({ filled: false });

    assert.equal(filled.press("v"), true);
    assert.equal(empty.press("v"), false);
    assert.deepEqual(filled.pasted, [kAim]);
  });

  test("ignores the letters without Mod", () => {
    const { copies, pasted, press } = setup({ placing: true });

    press("c", {});
    press("v", {});
    press("v", { shiftKey: true, ...kMod });

    assert.deepEqual(copies, []);
    assert.deepEqual(pasted, []);
  });

  test("stops listening once disposed", () => {
    const { copies, release, press } = setup({ placing: true });

    release();
    press("c");

    assert.deepEqual(copies, []);
  });
});
