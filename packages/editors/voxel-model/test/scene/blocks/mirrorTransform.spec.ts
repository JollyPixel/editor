// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  mirrorRotation,
  mirrorSignFromAxes,
  mirrorVector
} from "#src/scene/blocks/mirrorTransform.ts";

function boxCorners(): THREE.Vector3[] {
  const half = 0.5;
  const corners: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push(new THREE.Vector3(sx * half, sy * half, sz * half));
      }
    }
  }

  return corners;
}

function sortedKeys(
  vectors: THREE.Vector3[]
): string[] {
  return vectors
    .map((vector) => `${vector.x.toFixed(4)},${vector.y.toFixed(4)},${vector.z.toFixed(4)}`)
    .sort();
}

describe("mirrorRotation", () => {
  test("reproduces the box footprint of a literal world-axis reflection, for a single flipped axis", () => {
    const sign = mirrorSignFromAxes({ x: true, y: false, z: false });
    const rotation = new THREE.Euler(0, Math.PI / 2, 0.3);
    const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotation);

    const expectedCorners = boxCorners().map((corner) => (
      corner.clone().applyMatrix4(rotationMatrix).multiply(sign)
    ));

    const mirroredMatrix = new THREE.Matrix4().makeRotationFromEuler(mirrorRotation(rotation, sign));
    const actualCorners = boxCorners().map((corner) => corner.clone().applyMatrix4(mirroredMatrix));

    assert.deepEqual(sortedKeys(actualCorners), sortedKeys(expectedCorners));
  });

  test("reproduces the box footprint when mirroring two axes at once", () => {
    const sign = mirrorSignFromAxes({ x: true, y: true, z: false });
    const rotation = new THREE.Euler(0.4, -0.6, 0.2);
    const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotation);

    const expectedCorners = boxCorners().map((corner) => (
      corner.clone().applyMatrix4(rotationMatrix).multiply(sign)
    ));

    const mirroredMatrix = new THREE.Matrix4().makeRotationFromEuler(mirrorRotation(rotation, sign));
    const actualCorners = boxCorners().map((corner) => corner.clone().applyMatrix4(mirroredMatrix));

    assert.deepEqual(sortedKeys(actualCorners), sortedKeys(expectedCorners));
  });

  test("leaves an unrotated box unchanged", () => {
    const sign = mirrorSignFromAxes({ x: true, y: false, z: true });
    const mirrored = mirrorRotation(new THREE.Euler(0, 0, 0), sign);

    assert.equal(Object.is(mirrored.x, -0) ? 0 : mirrored.x, 0);
    assert.equal(Object.is(mirrored.y, -0) ? 0 : mirrored.y, 0);
    assert.equal(Object.is(mirrored.z, -0) ? 0 : mirrored.z, 0);
  });
});

describe("mirrorVector", () => {
  test("negates only the selected axes", () => {
    const sign = mirrorSignFromAxes({ x: true, y: false, z: true });

    assert.deepStrictEqual(
      mirrorVector(new THREE.Vector3(2, 3, 4), sign),
      new THREE.Vector3(-2, 3, -4)
    );
  });
});
