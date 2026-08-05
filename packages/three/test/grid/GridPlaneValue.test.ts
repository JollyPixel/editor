// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { GridPlaneValue } from "#src/grid/GridPlaneValue.ts";

describe("GridPlaneValue", () => {
  test("throws for an invalid plane", () => {
    assert.throws(
      // @ts-expect-error Testing invalid plane
      () => new GridPlaneValue("invalid"),
      /Invalid plane "invalid"/
    );
  });

  test("value reflects the constructed plane", () => {
    const plane = new GridPlaneValue("yz");

    assert.strictEqual(plane.value, "yz");
  });

  describe("followPosition", () => {
    test("\"xz\" pins the normal axis (y) to the offset", () => {
      const plane = new GridPlaneValue("xz");

      const result = plane.followPosition(
        { x: 5, y: 3, z: -2 },
        0
      );

      assert.deepStrictEqual(
        result,
        { x: 5, y: 0, z: -2 }
      );
    });

    test("\"xy\" pins the normal axis (z) to the offset", () => {
      const plane = new GridPlaneValue("xy");

      const result = plane.followPosition(
        { x: 5, y: 3, z: -2 },
        0
      );

      assert.deepStrictEqual(
        result,
        { x: 5, y: 3, z: 0 }
      );
    });

    test("\"yz\" pins the normal axis (x) to the offset", () => {
      const plane = new GridPlaneValue("yz");

      const result = plane.followPosition(
        { x: 5, y: 3, z: -2 },
        0
      );

      assert.deepStrictEqual(
        result,
        { x: 0, y: 3, z: -2 }
      );
    });

    test("non-zero normalOffset only affects the normal axis", () => {
      const plane = new GridPlaneValue("xz");

      const result = plane.followPosition(
        { x: 5, y: 3, z: -2 },
        4
      );

      assert.deepStrictEqual(
        result,
        { x: 5, y: 4, z: -2 }
      );
    });
  });

  describe("orientGeometry", () => {
    function boundingBox(
      plane: GridPlaneValue
    ): THREE.Box3 {
      const geometry = new THREE.PlaneGeometry(2, 2);
      plane.orientGeometry(geometry);
      geometry.computeBoundingBox();

      const box = geometry.boundingBox;
      assert.ok(box);

      return box;
    }

    // rotateX/rotateY bake the rotation into vertex data via cos/sin(π/2),
    // which isn't exactly 0 in floating point.
    function assertNear(
      actual: number,
      expected: number
    ): void {
      assert.ok(
        Math.abs(actual - expected) < 1e-10,
        `expected ${actual} to be close to ${expected}`
      );
    }

    test("\"xz\" flattens the geometry onto y = 0", () => {
      const box = boundingBox(new GridPlaneValue("xz"));

      assertNear(box.min.y, 0);
      assertNear(box.max.y, 0);
      assertNear(box.min.x, -1);
      assertNear(box.min.z, -1);
    });

    test("\"yz\" flattens the geometry onto x = 0", () => {
      const box = boundingBox(new GridPlaneValue("yz"));

      assertNear(box.min.x, 0);
      assertNear(box.max.x, 0);
      assertNear(box.min.y, -1);
      assertNear(box.min.z, -1);
    });

    test("\"xy\" leaves the geometry flat on z = 0", () => {
      const box = boundingBox(new GridPlaneValue("xy"));

      assert.strictEqual(box.min.z, 0);
      assert.strictEqual(box.max.z, 0);
      assert.strictEqual(box.min.x, -1);
      assert.strictEqual(box.min.y, -1);
    });
  });
});
