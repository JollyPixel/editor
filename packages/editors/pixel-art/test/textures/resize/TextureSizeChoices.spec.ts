// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  UVRegion,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TextureSizeChoices } from "../../../src/textures/resize/TextureSizeChoices.ts";

function region(
  id: string,
  rect: SelectionRect
): UVRegion {
  return UVRegion.from({
    id,
    color: "#ff0000",
    state: "stacked",
    rect
  });
}

function enabled(
  choices: TextureSizeChoices,
  axis: "x" | "y"
): number[] {
  return choices.axis(axis)
    .filter((option) => option.disabled !== true)
    .map((option) => option.value);
}

describe("TextureSizeChoices", () => {
  test("disables sizes that would cut off the far edge of a UV region", () => {
    const choices = new TextureSizeChoices([
      region("a", { x: 40, y: 0, width: 24, height: 8 }),
      region("b", { x: 0, y: 10, width: 8, height: 20 })
    ], 2048, { x: 64, y: 64 });

    assert.deepEqual(enabled(choices, "x"), [64, 128, 256, 512, 1024, 2048]);
    assert.deepEqual(enabled(choices, "y"), [32, 64, 128, 256, 512, 1024, 2048]);
  });

  test("lists an imported off-grid size and stops at the maximum size", () => {
    const choices = new TextureSizeChoices([], 256, { x: 48, y: 64 });

    assert.deepEqual(
      choices.axis("x").map((option) => option.value),
      [16, 32, 48, 64, 128, 256]
    );
  });

  test("keeps the current size selectable when a region already overflows it", () => {
    const choices = new TextureSizeChoices([
      region("a", { x: 0, y: 0, width: 80, height: 8 })
    ], 2048, { x: 64, y: 64 });

    assert.deepEqual(enabled(choices, "x"), [64, 128, 256, 512, 1024, 2048]);
  });
});
