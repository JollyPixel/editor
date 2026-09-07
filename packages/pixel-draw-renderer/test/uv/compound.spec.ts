// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVGeometryValue,
  partsOf,
  pointInGeometry,
  triangleCornerOf
} from "../../src/uv/geometry.ts";
import { UVSlotMap } from "../../src/uv/UVSlotMap.ts";
import { UVRegion } from "../../src/uv/UVRegion.ts";
import type {
  UVCompound,
  UVGeometry
} from "../../src/uv/types.ts";

// CONSTANTS
const kStairSide: UVCompound = {
  shape: "compound",
  rect: { x: 0, y: 0, width: 16, height: 16 },
  parts: [
    { x: 0, y: 0.5, width: 1, height: 0.5 },
    { x: 0.5, y: 0, width: 0.5, height: 0.5 }
  ]
};

describe("UVGeometryValue — compound", () => {
  test("bounds are the compound's own rect", () => {
    assert.deepStrictEqual(
      UVGeometryValue.from(kStairSide).bounds,
      { x: 0, y: 0, width: 16, height: 16 }
    );
  });

  test("contains a point covered by any part", () => {
    const value = UVGeometryValue.from(kStairSide);

    assert.equal(value.contains({ x: 2, y: 12 }), true, "lower part");
    assert.equal(value.contains({ x: 12, y: 2 }), true, "upper part");
  });

  test("does not contain the notch an L leaves open", () => {
    assert.equal(
      UVGeometryValue.from(kStairSide).contains({ x: 2, y: 2 }),
      false,
      "the notch is inside the bounds but covered by no part"
    );
  });

  test("rejects a point outside the bounds", () => {
    assert.equal(
      UVGeometryValue.from(kStairSide).contains({ x: 40, y: 2 }),
      false
    );
  });

  test("scales its parts with new bounds, keeping the notch proportional", () => {
    const moved = UVGeometryValue
      .from(kStairSide)
      .withBounds({ x: 32, y: 32, width: 32, height: 32 })
      .toJSON() as UVCompound;

    assert.deepStrictEqual(moved.rect, { x: 32, y: 32, width: 32, height: 32 });
    assert.deepStrictEqual(moved.parts, kStairSide.parts);
    assert.equal(pointInGeometry({ x: 36, y: 36 }, moved), false);
    assert.equal(pointInGeometry({ x: 36, y: 60 }, moved), true);
  });

  test("round-trips through toJSON without sharing part objects", () => {
    const copy = UVGeometryValue.from(kStairSide).toJSON() as UVCompound;

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

  test("partsOf places each part in the geometry's own space", () => {
    assert.deepStrictEqual(partsOf(kStairSide), [
      { x: 0, y: 8, width: 16, height: 8 },
      { x: 8, y: 0, width: 8, height: 8 }
    ]);
  });

  test("partsOf yields a non-compound geometry unchanged", () => {
    const rect = { x: 1, y: 2, width: 3, height: 4 };

    assert.deepStrictEqual(partsOf(rect), [rect]);
  });
});

describe("UVSlotMap — open slot list", () => {
  test("carries the slots it was given, in order", () => {
    const map = new UVSlotMap({
      top: { x: 0, y: 0, width: 1, height: 1 },
      "top.1": { x: 2, y: 0, width: 1, height: 1 }
    });

    assert.deepStrictEqual(map.faces, ["top", "top.1"]);
    assert.equal(map.has("top.1"), true);
    assert.equal(map.has("bottom"), false);
  });

  test("rejects an unknown slot", () => {
    const map = new UVSlotMap({
      top: { x: 5, y: 0, width: 1, height: 1 }
    });

    assert.throws(() => map.get("nope"), RangeError);
  });

  test("translating keeps every slot", () => {
    const map = new UVSlotMap({
      top: { x: 0, y: 0, width: 1, height: 1 },
      "top.1": { x: 2, y: 0, width: 1, height: 1 }
    }).translated(10, 0);

    assert.deepStrictEqual(map.faces, ["top", "top.1"]);
    assert.deepStrictEqual(map.get("top.1"), {
      x: 12,
      y: 0,
      width: 1,
      height: 1
    });
  });
});

describe("UVRegion — a shape's own slots", () => {
  const stairFaces: Record<string, UVGeometry> = {
    right: kStairSide,
    top: { x: 0, y: 0, width: 16, height: 16 },
    "top.1": { x: 0, y: 0, width: 16, height: 16 }
  };

  test("keeps eight-slot topology through facesOf", () => {
    const region = new UVRegion({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: stairFaces
    });

    assert.deepStrictEqual(
      region.facesOf().map(({ face }) => face),
      ["right", "top", "top.1"]
    );
    assert.deepStrictEqual(region.faces, ["right", "top", "top.1"]);
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
      region.facesOf().map(({ face }) => face),
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
