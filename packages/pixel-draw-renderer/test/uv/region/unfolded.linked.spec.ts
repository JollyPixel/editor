// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVNet,
  UVRegion,
  type UVGeometry,
  type UVSlot
} from "#src/uv/region/UVRegion.ts";

// CONSTANTS
const kCapsAndSides = new UVNet([
  [["top", "bottom"], ["front", "back", "left", "right"], "east"]
]);

function capsAndSides(): UVRegion {
  return new UVRegion({
    id: "r1",
    color: "#f00",
    state: "stacked",
    rect: { x: 0, y: 0, width: 4, height: 4 },
    faces: Object.fromEntries(
      ["front", "back", "left", "right", "top", "bottom", "east"].map(
        (slot) => [slot, { x: 0, y: 0, width: 4, height: 4 }]
      )
    )
  }).unfold(kCapsAndSides);
}

function rects(
  region: UVRegion
): Record<UVSlot, UVGeometry> {
  return Object.fromEntries(
    region.activeSlots.map((slot) => [slot, region.slotGeometry(slot)])
  );
}

describe("UVRegion unfolded with shared cells", () => {
  test("resizes every slot sharing a rectangle and pushes neighbours once", () => {
    const resized = capsAndSides().resized(
      { x: 0, y: 0, width: 6, height: 4 },
      "bottom"
    );

    const caps = { x: 0, y: 0, width: 6, height: 4 };
    const sides = { x: 6, y: 0, width: 4, height: 4 };
    assert.deepStrictEqual(rects(resized), {
      front: sides,
      back: sides,
      left: sides,
      right: sides,
      top: caps,
      bottom: caps,
      east: { x: 10, y: 0, width: 4, height: 4 }
    });
  });

  test("offers one resize target per shared rectangle", () => {
    const targets = capsAndSides().resizeTargets(null);

    assert.deepStrictEqual(
      targets.map(({ slot, rect }) => [slot, rect.x]),
      [["front", 4], ["top", 0], ["east", 8]]
    );
  });
});
