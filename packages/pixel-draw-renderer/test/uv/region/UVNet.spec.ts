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
  type UVSlot
} from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kBoxNet = new UVNet([
  [null, "top", "bottom"],
  ["right", "front", "left", "back"]
]);

function stackedRegion(
  activeFaces?: UVSlot[]
): UVRegion {
  return new UVRegion({
    state: "stacked",
    id: "r1",
    color: "#f00",
    rect: { x: 2, y: 3, width: 4, height: 4 },
    ...(activeFaces ? { activeFaces } : {})
  });
}

function rects(
  region: UVRegion
): Record<UVSlot, SelectionRect> {
  return Object.fromEntries(
    region.slotsOf().map(({ slot, geometry }) => [slot, "shape" in geometry ? geometry.rect : geometry])
  );
}

describe("UVNet", () => {
  test("unfolds each active slot into its grid cell from the region origin", () => {
    const region = stackedRegion().unfold(kBoxNet);

    assert.deepStrictEqual(rects(region), {
      top: { x: 6, y: 3, width: 4, height: 4 },
      bottom: { x: 10, y: 3, width: 4, height: 4 },
      right: { x: 2, y: 7, width: 4, height: 4 },
      front: { x: 6, y: 7, width: 4, height: 4 },
      left: { x: 10, y: 7, width: 4, height: 4 },
      back: { x: 14, y: 7, width: 4, height: 4 }
    });
    assert.deepStrictEqual(region.bounds, { x: 2, y: 3, width: 16, height: 8 });
  });

  test("sizes each column to its widest slot and each row to its tallest", () => {
    const at = { x: 10, y: 20 };
    const region = new UVRegion({
      state: "free",
      id: "r1",
      color: "#f00",
      faces: {
        a: { ...at, width: 2, height: 3 },
        b: { ...at, width: 4, height: 1 },
        c: { ...at, width: 1, height: 2 },
        d: { ...at, width: 3, height: 5 }
      }
    }).unfold(new UVNet([["a", "b"], ["c", "d"]]));

    assert.deepStrictEqual(rects(region), {
      a: { x: 10, y: 20, width: 2, height: 3 },
      b: { x: 12, y: 20, width: 4, height: 1 },
      c: { x: 10, y: 23, width: 1, height: 2 },
      d: { x: 12, y: 23, width: 3, height: 5 }
    });
  });

  test("leaves the cell of an inactive slot empty", () => {
    const region = stackedRegion(["top", "bottom", "right", "left", "back"]).unfold(kBoxNet);

    assert.deepStrictEqual(rects(region).right, { x: 2, y: 7, width: 4, height: 4 });
    assert.deepStrictEqual(rects(region).left, { x: 10, y: 7, width: 4, height: 4 });
    assert.deepStrictEqual(rects(region).back, { x: 14, y: 7, width: 4, height: 4 });
  });

  test("packs the region when an active slot has no cell in the grid", () => {
    const net = new UVNet([["front", "back", "left", "right", "top"]]);

    assert.deepStrictEqual(
      rects(stackedRegion().unfold(net)),
      rects(stackedRegion().unfold())
    );
  });

  test("rejects a grid without slots or with a repeated slot", () => {
    assert.throws(() => new UVNet([[null], []]), RangeError);
    assert.throws(() => new UVNet([["top"], [null, "top"]]), RangeError);
  });
});
