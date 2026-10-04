// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  copyGeometry,
  geometryAt,
  pointInGeometry,
  rectOf,
  triangleCornerOf
} from "../../../src/uv/geometry/geometry.ts";
import { UVRegion } from "../../../src/uv/region/UVRegion.ts";
import type {
  UVCompound,
  UVGeometry
} from "../../../src/uv/geometry/types.ts";

// CONSTANTS
const kStairSide: UVCompound = {
  shape: "compound",
  rect: { x: 0, y: 0, width: 16, height: 16 },
  parts: [
    { x: 0, y: 0.5, width: 1, height: 0.5 },
    { x: 0.5, y: 0, width: 0.5, height: 0.5 }
  ]
};

describe("compound geometry", () => {
  test("bounds are the compound's own rect", () => {
    assert.deepStrictEqual(
      rectOf(kStairSide),
      { x: 0, y: 0, width: 16, height: 16 }
    );
  });

  test("contains a point covered by any part", () => {
    assert.equal(pointInGeometry({ x: 2, y: 12 }, kStairSide), true, "lower part");
    assert.equal(pointInGeometry({ x: 12, y: 2 }, kStairSide), true, "upper part");
  });

  test("does not contain the notch an L leaves open", () => {
    assert.equal(
      pointInGeometry({ x: 2, y: 2 }, kStairSide),
      false,
      "the notch is inside the bounds but covered by no part"
    );
  });

  test("scales its parts with new bounds, keeping the notch proportional", () => {
    const moved = geometryAt(
      kStairSide,
      { x: 32, y: 32, width: 32, height: 32 }
    ) as UVCompound;

    assert.deepStrictEqual(moved.rect, { x: 32, y: 32, width: 32, height: 32 });
    assert.deepStrictEqual(moved.parts, kStairSide.parts);
    assert.equal(pointInGeometry({ x: 36, y: 36 }, moved), false);
    assert.equal(pointInGeometry({ x: 36, y: 60 }, moved), true);
  });

  test("copyGeometry copies a compound without sharing part objects", () => {
    const copy = copyGeometry(kStairSide) as UVCompound;

    assert.deepStrictEqual(copy, kStairSide);
    assert.notEqual(copy.parts[0], kStairSide.parts[0]);
  });

  test("supports a triangle part", () => {
    const geometry: UVGeometry = {
      shape: "compound",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      parts: [
        {
          shape: "triangle",
          corner: "top-left",
          rect: { x: 0, y: 0, width: 1, height: 1 }
        }
      ]
    };

    assert.equal(pointInGeometry({ x: 1, y: 1 }, geometry), true);
    assert.equal(pointInGeometry({ x: 9, y: 9 }, geometry), false);
  });
});

describe("geometry helpers", () => {
  test("triangleCornerOf answers only for a triangle", () => {
    assert.equal(triangleCornerOf(kStairSide), null);
    assert.equal(
      triangleCornerOf({ x: 0, y: 0, width: 1, height: 1 }),
      null
    );
    assert.equal(
      triangleCornerOf({
        shape: "triangle",
        corner: "bottom-left",
        rect: { x: 0, y: 0, width: 1, height: 1 }
      }),
      "bottom-left"
    );
  });
});

describe("UVRegion — a shape's own slots", () => {
  const stairFaces: Record<string, UVGeometry> = {
    right: kStairSide,
    top: { x: 0, y: 0, width: 16, height: 16 },
    "top.1": { x: 0, y: 0, width: 16, height: 16 }
  };

  test("slotsOf carries the three slots it was given, in order", () => {
    const region = new UVRegion({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: stairFaces
    });

    assert.deepStrictEqual(
      region.slotsOf().map(({ slot }) => slot),
      ["right", "top", "top.1"]
    );
    assert.deepStrictEqual(region.slots, ["right", "top", "top.1"]);
    assert.throws(() => region.geometryFor("bottom"), RangeError);
  });

  test("stack skips a compound when picking the face to stack onto", () => {
    const region = new UVRegion({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: stairFaces
    }).stack("right");

    assert.equal(
      region.stackedFace,
      "top",
      "a stacked region paints one rect, which a compound cannot describe"
    );
  });

  test("drops an active face the region carries no geometry for", () => {
    const region = new UVRegion({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: stairFaces,
      activeFaces: ["top", "back.9"]
    });

    assert.deepStrictEqual(
      region.slotsOf().map(({ slot }) => slot),
      ["top"]
    );
  });

  test("round-trips a compound through toJSON", () => {
    const region = new UVRegion({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: stairFaces
    });
    const restored = new UVRegion(region.toJSON());

    assert.deepStrictEqual(
      restored.geometryFor("right"),
      kStairSide
    );
  });
});
