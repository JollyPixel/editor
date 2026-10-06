// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ShadowTexelSnap
} from "../../../src/scene/environment/ShadowTexelSnap.ts";

// CONSTANTS
const kEpsilon = 1e-6;
const kSunDistance = 96;
const kSunDirections = [
  new THREE.Vector3(10, 20, 10).normalize(),
  new THREE.Vector3(-0.62, 0.55, 0.56).normalize()
];
const kFocusPoints = [
  new THREE.Vector3(0.3, 4.1, -7.9),
  new THREE.Vector3(12.25, -3, 40.7),
  new THREE.Vector3(-55.5, 18.2, 3.33)
];

function shadowCameraAt(
  focus: THREE.Vector3,
  sunDirection: THREE.Vector3
): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera();
  camera.position.copy(focus).addScaledVector(sunDirection, kSunDistance);
  camera.lookAt(focus);
  camera.updateMatrixWorld();

  return camera;
}

function isWholeTexels(
  value: number,
  texelSize: number
): boolean {
  const texels = value / texelSize;

  return Math.abs(texels - Math.round(texels)) < kEpsilon;
}

describe("ShadowTexelSnap", () => {
  test("derives the texel size from the frustum and map sizes", () => {
    assert.equal(new ShadowTexelSnap(96, 2048).texelSize, 0.046875);
  });

  for (const sunDirection of kSunDirections) {
    test(`shadow frusta of snapped foci differ by whole texels (sun ${sunDirection.toArray()})`, () => {
      const snap = new ShadowTexelSnap(96, 2048);
      const origin = snap.apply(new THREE.Vector3(), sunDirection);
      const reference = shadowCameraAt(origin, sunDirection);

      for (const point of kFocusPoints) {
        const focus = snap.apply(point.clone(), sunDirection);
        const offset = shadowCameraAt(focus, sunDirection).position.clone()
          .applyMatrix4(reference.matrixWorldInverse);

        assert.ok(isWholeTexels(offset.x, snap.texelSize), `x ${offset.x}`);
        assert.ok(isWholeTexels(offset.y, snap.texelSize), `y ${offset.y}`);
      }
    });
  }

  test("moves a point by at most half a texel diagonal and is idempotent", () => {
    const snap = new ShadowTexelSnap(96, 2048);
    const [sunDirection] = kSunDirections;

    for (const point of kFocusPoints) {
      const snapped = snap.apply(point.clone(), sunDirection);
      const again = snap.apply(snapped.clone(), sunDirection);

      assert.ok(
        snapped.distanceTo(point) <= (snap.texelSize * Math.SQRT1_2) + kEpsilon
      );
      assert.ok(again.distanceTo(snapped) < kEpsilon);
    }
  });
});
