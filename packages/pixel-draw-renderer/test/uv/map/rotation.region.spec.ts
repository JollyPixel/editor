// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { rectOf } from "#src/uv/geometry/geometry.ts";
import {
  UVRegion,
  type UVGeometry,
  type UVRegionData
} from "#src/uv/region/UVRegion.ts";

function unfoldedPair(): UVRegion {
  return new UVRegion({
    id: "net",
    color: "#f00",
    state: "unfolded",
    faces: {
      front: { x: 0, y: 0, width: 16, height: 8 },
      top: { x: 16, y: 0, width: 8, height: 8 }
    }
  });
}

function freeRegion(
  faces: UVRegionData & { state: "free"; }
): UVRegion {
  return new UVRegion(faces);
}

describe("UVRegion.rotated", () => {
  test("a stacked region rotates its shared rect and every slot", () => {
    const region = new UVRegion({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 16, height: 8 }
    });

    const rotated = region.rotated("cw");

    assert.deepStrictEqual(rotated.bounds, { x: 0, y: 0, width: 8, height: 16 });
    for (const slot of rotated.slots) {
      assert.strictEqual(rotated.geometryFor(slot).rotation, 1);
    }
    assert.deepStrictEqual(rotated.toJSON(), {
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 8, height: 16, rotation: 1 }
    });
    assert.deepStrictEqual(
      new UVRegion(rotated.toJSON()).toJSON(),
      rotated.toJSON()
    );
  });

  test("a stacked rotation survives free and unfold", () => {
    const rotated = new UVRegion({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 16, height: 8 }
    }).rotated("ccw");

    for (const region of [rotated.free(), rotated.unfold()]) {
      for (const slot of region.activeSlots) {
        assert.strictEqual(region.geometryFor(slot).rotation, 3);
        assert.strictEqual(rectOf(region.geometryFor(slot)).width, 8);
      }
    }
  });

  test("an unfolded net turns as one piece around its bounds", () => {
    const rotated = unfoldedPair().rotated("cw");

    assert.deepStrictEqual(rotated.geometryFor("front"), {
      x: 0,
      y: 0,
      width: 8,
      height: 16,
      rotation: 1
    });
    assert.deepStrictEqual(rotated.geometryFor("top"), {
      x: 0,
      y: 16,
      width: 8,
      height: 8,
      rotation: 1
    });
    assert.deepStrictEqual(rotated.bounds, { x: 0, y: 0, width: 8, height: 24 });
  });

  test("clockwise then counter-clockwise restores an unfolded net", () => {
    const region = unfoldedPair();

    assert.deepStrictEqual(
      region.rotated("cw").rotated("ccw").toJSON(),
      region.toJSON()
    );
    assert.deepStrictEqual(
      region
        .rotated("cw")
        .rotated("cw")
        .rotated("cw")
        .rotated("cw")
        .toJSON(),
      region.toJSON()
    );
  });

  test("a free region rotates only the given slot in place", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 4, y: 4, width: 16, height: 8 },
        top: { x: 0, y: 20, width: 16, height: 8 }
      }
    });

    const rotated = region.rotated("cw", "front");

    assert.deepStrictEqual(rotated.geometryFor("front"), {
      x: 4,
      y: 4,
      width: 8,
      height: 16,
      rotation: 1
    });
    assert.deepStrictEqual(rotated.geometryFor("top"), region.geometryFor("top"));
    assert.strictEqual(region.rotated("cw"), region);
    assert.strictEqual(region.rotated("cw", "unknown"), region);
  });

  test("moving a rotated free slot keeps its rotation", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 4, height: 8, rotation: 1 }
      }
    });

    const moved = region.withRect({ x: 10, y: 10, width: 4, height: 8 }, "front");

    assert.strictEqual(moved.geometryFor("front").rotation, 1);
  });

  test("withGeometry replaces one free slot and ignores other states", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 4, height: 8 }
      }
    });
    const geometry: UVGeometry = { x: 0, y: 0, width: 8, height: 4, rotation: 1 };

    assert.deepStrictEqual(
      region.withGeometry("front", geometry).geometryFor("front"),
      geometry
    );
    assert.strictEqual(region.withGeometry("top", geometry), region);
    assert.strictEqual(unfoldedPair().withGeometry("front", geometry).state, "unfolded");
  });
});

describe("UVRegion.stack rotation", () => {
  test("stacking adopts the most common rotation among the active slots", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 8, height: 8, rotation: 1 },
        back: { x: 8, y: 0, width: 8, height: 8, rotation: 1 },
        top: { x: 16, y: 0, width: 8, height: 8 }
      }
    });

    const stacked = region.stack();

    assert.strictEqual(stacked.geometryFor("top").rotation, 1);
    assert.strictEqual(stacked.free().geometryFor("top").rotation, 1);
  });

  test("a tie keeps the rotation of the slot being stacked on", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 8, height: 8, rotation: 1 },
        top: { x: 16, y: 0, width: 8, height: 8 }
      }
    });

    assert.strictEqual(region.stack("top").geometryFor("front").rotation, undefined);
    assert.strictEqual(region.stack("front").geometryFor("top").rotation, 1);
  });

  test("an outvoted stack target turns back to the dominant rotation", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 8, height: 16, rotation: 1 },
        back: { x: 8, y: 0, width: 16, height: 8 },
        top: { x: 24, y: 0, width: 16, height: 8 }
      }
    });

    const stacked = region.stack("front");

    assert.deepStrictEqual(stacked.geometryFor("front"), {
      x: 0,
      y: 0,
      width: 16,
      height: 8
    });
    assert.deepStrictEqual(
      stacked.free().geometryFor("front"),
      { x: 0, y: 0, width: 16, height: 8 }
    );
  });
});
