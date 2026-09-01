// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import { VoxelRotation } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  resolveFlipY,
  resolveRotation
} from "../../../src/components/brush/orientation.ts";

function cameraLookingAt(
  x: number,
  y: number,
  z: number
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
  camera.position.set(0, 0, 0);
  camera.lookAt(x, y, z);
  camera.updateMatrixWorld(true);

  return camera;
}

describe("resolveRotation", () => {
  test("returns an explicit mode untouched, whatever the camera does", () => {
    const camera = cameraLookingAt(0, 0, 10);

    assert.strictEqual(
      resolveRotation(camera, VoxelRotation.CW90),
      VoxelRotation.CW90
    );
    assert.strictEqual(
      resolveRotation(camera, VoxelRotation.None),
      VoxelRotation.None
    );
  });

  test("auto quantizes to the horizontal axis the view leans on", () => {
    const cases: [number, number, number][] = [
      [0, 0, 10],
      [0, 0, -10],
      [10, 0, 0],
      [-10, 0, 0]
    ];
    const expected = [
      VoxelRotation.None,
      VoxelRotation.Deg180,
      VoxelRotation.CCW90,
      VoxelRotation.CW90
    ];

    for (const [index, [x, y, z]] of cases.entries()) {
      assert.strictEqual(
        resolveRotation(cameraLookingAt(x, y, z), "auto"),
        expected[index],
        `looking at ${x},${y},${z}`
      );
    }
  });

  test("auto ignores the vertical part of the view direction", () => {
    assert.strictEqual(
      resolveRotation(cameraLookingAt(1, -20, 10), "auto"),
      VoxelRotation.None
    );
  });

  test("auto favors the z axis on a perfect diagonal", () => {
    assert.strictEqual(
      resolveRotation(cameraLookingAt(10, 0, 10), "auto"),
      VoxelRotation.None
    );
  });
});

describe("resolveFlipY", () => {
  test("a forced flip wins over every mode", () => {
    assert.ok(resolveFlipY(cameraLookingAt(0, -10, 1), "auto", true));
    assert.ok(resolveFlipY(cameraLookingAt(0, -10, 1), VoxelRotation.None, true));
  });

  test("auto flips while the camera looks upwards", () => {
    assert.ok(resolveFlipY(cameraLookingAt(0, 10, 1), "auto", false));
  });

  test("auto leaves a downwards view unflipped", () => {
    assert.ok(!resolveFlipY(cameraLookingAt(0, -10, 1), "auto", false));
  });

  test("an explicit rotation mode never flips on its own", () => {
    assert.ok(
      !resolveFlipY(cameraLookingAt(0, 10, 1), VoxelRotation.CW90, false)
    );
  });
});
