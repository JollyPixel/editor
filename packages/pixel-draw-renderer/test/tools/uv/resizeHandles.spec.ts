// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resizedRect,
  resizeHandleAt
} from "#src/tools/uv/resizeHandles.ts";
import type {
  UVResizeHandle,
  UVResizeTarget
} from "#src/uv/region/layout/UVResizeTarget.ts";
import { makeViewport } from "../../helpers/overlay.ts";
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kView = makeViewport(4, undefined, { x: 10, y: 10 });
const kRect = {
  x: 0,
  y: 0,
  width: 8,
  height: 8
};
const kEveryHandle: UVResizeHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const kNetHandles: UVResizeHandle[] = ["e", "s"];

function target(
  rect: SelectionRect,
  handles = kEveryHandle,
  slot: string | null = null
): UVResizeTarget {
  return {
    id: "r1",
    slot,
    rect,
    handles
  };
}

function stacked(): UVRegion {
  return new UVRegion({
    id: "r1",
    color: "#f00",
    state: "stacked",
    rect: kRect
  });
}

describe("resizedRect", () => {
  test("moves the dragged corner and keeps the opposite one", () => {
    assert.deepEqual(
      resizedRect(kRect, "se", { x: 2, y: -3 }),
      { x: 0, y: 0, width: 10, height: 5 }
    );
    assert.deepEqual(
      resizedRect(kRect, "nw", { x: 2, y: -3 }),
      { x: 2, y: -3, width: 6, height: 11 }
    );
  });

  test("an edge handle ignores the other axis", () => {
    assert.deepEqual(
      resizedRect(kRect, "n", { x: 5, y: 2 }),
      { x: 0, y: 2, width: 8, height: 6 }
    );
  });

  test("stops at 1px against the anchored edge", () => {
    assert.deepEqual(
      resizedRect(kRect, "e", { x: -20, y: 0 }),
      { x: 0, y: 0, width: 1, height: 8 }
    );
    assert.deepEqual(
      resizedRect(kRect, "w", { x: 20, y: 0 }),
      { x: 7, y: 0, width: 1, height: 8 }
    );
  });
});

describe("resizeHandleAt", () => {
  const targets = [target(kRect)];

  test("finds corners and edges in canvas pixels", () => {
    assert.equal(resizeHandleAt(targets, { x: 42, y: 42 }, kView)?.handle, "se");
    assert.equal(resizeHandleAt(targets, { x: 8, y: 11 }, kView)?.handle, "nw");
    assert.equal(resizeHandleAt(targets, { x: 26, y: 10 }, kView)?.handle, "n");
    assert.equal(resizeHandleAt(targets, { x: 46, y: 26 }, kView)?.handle, "e");
  });

  test("leaves the middle and the outside for moving and picking", () => {
    assert.equal(resizeHandleAt(targets, { x: 26, y: 26 }, kView), null);
    assert.equal(resizeHandleAt(targets, { x: 60, y: 26 }, kView), null);
    assert.equal(resizeHandleAt(targets, { x: 26, y: 50 }, kView), null);
  });

  test("keeps a move area inside a rectangle smaller than the reach", () => {
    const small = [
      target({
        x: 0,
        y: 0,
        width: 3,
        height: 3
      })
    ];

    assert.equal(resizeHandleAt(small, { x: 16, y: 16 }, kView), null);
    assert.equal(resizeHandleAt(small, { x: 21, y: 16 }, kView)?.handle, "e");
  });

  test("resizes the face before a line two net faces share, from either side", () => {
    const net = [
      target(kRect, kNetHandles, "front"),
      target({ ...kRect, x: 8 }, kNetHandles, "back")
    ];

    for (const x of [41, 43]) {
      const hit = resizeHandleAt(net, { x, y: 26 }, kView);
      assert.deepEqual([hit?.id, hit?.slot, hit?.handle], ["r1", "front", "e"]);
    }
  });

  test("offers a net face only its east and south edges", () => {
    const face = [target(kRect, kNetHandles, "front")];

    assert.equal(resizeHandleAt(face, { x: 41, y: 39 }, kView)?.handle, "e");
    assert.equal(resizeHandleAt(face, { x: 39, y: 41 }, kView)?.handle, "s");
    assert.equal(resizeHandleAt(face, { x: 44, y: 44 }, kView), null);
    assert.equal(resizeHandleAt(face, { x: 11, y: 26 }, kView), null);
    assert.equal(resizeHandleAt(face, { x: 26, y: 11 }, kView), null);
  });
});

describe("resizeTargets", () => {
  test("follows the region state", () => {
    const region = stacked();

    assert.deepEqual(
      region.resizeTargets(null),
      [target(kRect)]
    );
    assert.deepEqual(
      region.free().resizeTargets("top"),
      [target(kRect, kEveryHandle, "top")]
    );
    assert.deepEqual(
      region.unfold().resizeTargets(null).map(({ slot, handles }) => [slot, handles]),
      region.activeSlots.map((slot) => [slot, kNetHandles])
    );
  });

  test("offers nothing on a region with a triangular face", () => {
    const ramp = new UVRegion({
      id: "r1",
      color: "#f00",
      state: "free",
      faces: {
        front: kRect,
        left: {
          shape: "triangle",
          rect: kRect,
          corner: "top-left"
        }
      }
    });

    assert.deepEqual(ramp.resizeTargets("front"), []);
  });
});
