// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  nearestLayerBounds,
  type BoundedLayer
} from "../../../src/scene/camera/layerBounds.ts";

function createBox(
  min: THREE.Vector3Like,
  max: THREE.Vector3Like
): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  );
}

function createLayer(
  min: THREE.Vector3Like | null,
  max: THREE.Vector3Like = { x: 0, y: 0, z: 0 },
  visible = true
): BoundedLayer {
  return {
    visible,
    worldBounds: () => (min === null ? null : createBox(min, max))
  };
}

describe("nearestLayerBounds", () => {
  test("ignores empty and hidden layers", () => {
    const bounds = nearestLayerBounds([
      createLayer(null),
      createLayer({ x: 40, y: 0, z: 40 }, { x: 42, y: 2, z: 42 }, false)
    ]);

    assert.equal(bounds, null);
  });

  test("picks the layer nearest to the world origin", () => {
    const bounds = nearestLayerBounds([
      createLayer({ x: 100, y: 0, z: 100 }, { x: 104, y: 4, z: 104 }),
      createLayer({ x: 20, y: 0, z: 0 }, { x: 24, y: 4, z: 4 })
    ]);

    assert.deepEqual(bounds?.min.toArray(), [20, 0, 0]);
  });
});
