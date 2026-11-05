// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { modelScale } from "#src/scene/modelScale.ts";

describe("modelScale", () => {
  test("is the radius of the sphere around the model", () => {
    const bounds = new THREE.Box3(
      new THREE.Vector3(-0.01, -0.02, -0.02),
      new THREE.Vector3(0.01, 0.02, 0.02)
    );

    assert.ok(Math.abs(modelScale(bounds) - 0.03) < 1e-12);
  });

  test("falls back to 1 without a model or for a single point", () => {
    const point = new THREE.Vector3(2, 0, 0);

    assert.deepEqual(
      [
        modelScale(new THREE.Box3()),
        modelScale(new THREE.Box3(point, point))
      ],
      [1, 1]
    );
  });
});
