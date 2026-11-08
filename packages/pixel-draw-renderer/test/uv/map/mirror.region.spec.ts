// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  geometryMirrored,
  geometryRotation,
  rotateUv
} from "#src/uv/geometry/geometry.ts";
import {
  UVRegion,
  type UVGeometry,
  type UVQuarterTurn
} from "#src/uv/region/UVRegion.ts";
import type { MirrorAxis } from "#src/types.ts";

// CONSTANTS
const kFaceCorners: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1]
];

function stacked(
  rotation: UVQuarterTurn,
  mirrored: boolean
): UVRegion {
  return new UVRegion({
    id: "a",
    color: "#f00",
    state: "stacked",
    rect: {
      x: 0,
      y: 0,
      width: 8,
      height: 8,
      rotation,
      mirrored
    }
  });
}

function shownCorners(
  geometry: UVGeometry
): [number, number][] {
  return kFaceCorners.map(([u, v]) => rotateUv(
    geometryMirrored(geometry) ? 1 - u : u,
    v,
    geometryRotation(geometry)
  ));
}

function flipped(
  [u, v]: [number, number],
  axis: MirrorAxis
): [number, number] {
  return axis === "horizontal" ? [1 - u, v] : [u, 1 - v];
}

describe("UVRegion.mirrored", () => {
  for (const axis of ["horizontal", "vertical"] as const) {
    test(`a ${axis} mirror flips what every orientation shows across the canvas`, () => {
      for (const rotation of [0, 1, 2, 3] as const) {
        for (const mirrored of [false, true]) {
          const before = stacked(rotation, mirrored).slotGeometry("front");
          const after = stacked(rotation, mirrored).mirrored(axis).slotGeometry("front");

          assert.deepStrictEqual(
            shownCorners(after),
            shownCorners(before).map((corner) => flipped(corner, axis)),
            `rotation ${rotation}, mirrored ${mirrored}`
          );
        }
      }
    });
  }

  test("a stacked mirror reaches every slot and survives serialization and resize", () => {
    const region = stacked(0, false).mirrored("horizontal");

    assert.deepStrictEqual(region.toJSON(), {
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 8, height: 8, mirrored: true }
    });
    assert.deepStrictEqual(new UVRegion(region.toJSON()).toJSON(), region.toJSON());
    for (const slot of region.free().activeSlots) {
      assert.ok(geometryMirrored(region.free().slotGeometry(slot)));
    }
    assert.deepStrictEqual(
      region.resized({ x: 0, y: 0, width: 4, height: 4 }).slotGeometry("front"),
      { x: 0, y: 0, width: 4, height: 4, mirrored: true }
    );
  });

  test("an unfolded net mirrors as one piece across its bounds", () => {
    const region = new UVRegion({
      id: "net",
      color: "#f00",
      state: "unfolded",
      faces: {
        front: { x: 0, y: 0, width: 16, height: 8 },
        top: { x: 16, y: 0, width: 8, height: 8 }
      }
    });

    const mirrored = region.mirrored("horizontal");

    assert.deepStrictEqual(
      mirrored.slotGeometry("front"),
      { x: 8, y: 0, width: 16, height: 8, mirrored: true }
    );
    assert.deepStrictEqual(
      mirrored.slotGeometry("top"),
      { x: 0, y: 0, width: 8, height: 8, mirrored: true }
    );
    assert.deepStrictEqual(mirrored.mirrored("horizontal").toJSON(), region.toJSON());
  });

  test("a free region mirrors only the given slot", () => {
    const region = new UVRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 4, height: 8 },
        top: { x: 8, y: 0, width: 4, height: 8 }
      }
    });

    assert.strictEqual(region.mirrored("horizontal"), region);

    const mirrored = region.mirrored("vertical", "top");
    assert.deepStrictEqual(
      mirrored.slotGeometry("top"),
      { x: 8, y: 0, width: 4, height: 8, rotation: 2, mirrored: true }
    );
    assert.deepStrictEqual(mirrored.slotGeometry("front"), region.slotGeometry("front"));
  });

  test("a triangle slot cannot mirror and is left unchanged", () => {
    const ramp = new UVRegion({
      id: "ramp",
      color: "#f00",
      state: "free",
      faces: {
        back: { x: 0, y: 0, width: 8, height: 8 },
        left: {
          shape: "triangle",
          corner: "bottom-right",
          rect: { x: 8, y: 0, width: 8, height: 8 }
        }
      }
    });

    const stackedRamp = ramp.stack("back");

    assert.ok(ramp.canMirror("back"));
    assert.ok(!ramp.canMirror("left"));
    assert.ok(!stackedRamp.canMirror());
    assert.strictEqual(ramp.mirrored("horizontal", "left"), ramp);
    assert.strictEqual(stackedRamp.mirrored("horizontal"), stackedRamp);
  });
});
