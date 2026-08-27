// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { closestPointOnAxis } from "#src/area-box/projection.ts";

// CONSTANTS
const kXAxis = new THREE.Vector3(1, 0, 0);

function rayFrom(
  origin: [number, number, number],
  direction: [number, number, number]
): THREE.Ray {
  return new THREE.Ray(
    new THREE.Vector3(...origin),
    new THREE.Vector3(...direction).normalize()
  );
}

describe("closestPointOnAxis", () => {
  test("projects a perpendicular ray onto the axis", () => {
    const target = new THREE.Vector3();
    const projected = closestPointOnAxis(
      rayFrom([0, 5, 0], [0, -1, 0]),
      new THREE.Vector3(2, 0, 0),
      kXAxis,
      target
    );

    assert.equal(projected, true);
    assert.ok(target.distanceTo(new THREE.Vector3(0, 0, 0)) < 1e-9);
  });

  test("follows the pointer along the axis", () => {
    const target = new THREE.Vector3();
    closestPointOnAxis(
      rayFrom([7, 5, 0], [0, -1, 0]),
      new THREE.Vector3(2, 0, 0),
      kXAxis,
      target
    );

    assert.ok(Math.abs(target.x - 7) < 1e-9);
  });

  test("keeps the axis' other components", () => {
    const target = new THREE.Vector3();
    closestPointOnAxis(
      rayFrom([0, 5, 0], [0, -1, 0]),
      new THREE.Vector3(2, 3, 4),
      kXAxis,
      target
    );

    assert.equal(target.y, 3);
    assert.equal(target.z, 4);
  });

  test("rejects a ray parallel to the axis, leaving the target untouched", () => {
    const target = new THREE.Vector3(42, 42, 42);
    const projected = closestPointOnAxis(
      rayFrom([0, 5, 0], [1, 0, 0]),
      new THREE.Vector3(2, 0, 0),
      kXAxis,
      target
    );

    assert.equal(projected, false);
    assert.deepEqual(target.toArray(), [42, 42, 42]);
  });

  test("rejects a grazing ray, where the projection would diverge", () => {
    const target = new THREE.Vector3();
    const projected = closestPointOnAxis(
      rayFrom([0, 5, 0], [1, 0.02, 0]),
      new THREE.Vector3(2, 0, 0),
      kXAxis,
      target
    );

    assert.equal(projected, false);
  });

  test("accepts a ten degree angle", () => {
    const angle = THREE.MathUtils.degToRad(10);
    const target = new THREE.Vector3();
    const projected = closestPointOnAxis(
      rayFrom([0, 5, 0], [Math.cos(angle), Math.sin(angle), 0]),
      new THREE.Vector3(2, 0, 0),
      kXAxis,
      target
    );

    assert.equal(projected, true);
  });
});
