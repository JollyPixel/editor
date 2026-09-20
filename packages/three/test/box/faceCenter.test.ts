// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { faceCenter } from "#src/box/faceCenter.ts";

// CONSTANTS
const kMin = { x: 2, y: 0, z: -4 };
const kSize = { x: 8, y: 2, z: 6 };

describe("faceCenter", () => {
  test("sits on the max face for a positive sign", () => {
    const center = faceCenter(
      kMin,
      kSize,
      { axis: "x", sign: 1 },
      new THREE.Vector3()
    );

    assert.deepEqual(center.toArray(), [10, 1, -1]);
  });

  test("sits on the min face for a negative sign", () => {
    const center = faceCenter(
      kMin,
      kSize,
      { axis: "z", sign: -1 },
      new THREE.Vector3()
    );

    assert.deepEqual(center.toArray(), [6, 1, -4]);
  });

  test("writes into and returns the target", () => {
    const target = new THREE.Vector3();

    assert.equal(
      faceCenter(kMin, kSize, { axis: "y", sign: 1 }, target),
      target
    );
    assert.deepEqual(target.toArray(), [6, 2, -1]);
  });
});
