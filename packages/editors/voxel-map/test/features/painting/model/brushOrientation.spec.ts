// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockShapeRegistry,
  ShapeOccupancy,
  VoxelRotation,
  VoxelTransform
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { resolveBrushOrientation } from "../../../../src/features/painting/model/brushOrientation.ts";

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

describe("resolveBrushOrientation rotation", () => {
  test("auto places the high stair step away from every camera heading", () => {
    const shapes = BlockShapeRegistry.createDefault();
    for (const id of ["stair", "stairCornerOuter", "stairCornerPeak"]) {
      const shape = shapes.get(id);
      assert.ok(shape);

      for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (const flipY of [false, true]) {
          const orientation = resolveBrushOrientation(
            cameraLookingAt(x, -1, z), "auto", flipY, id
          );
          const occupancy = ShapeOccupancy.fromShape(
            shape, new VoxelTransform(orientation)
          );
          const y = flipY ? 0.25 : 0.75;
          assert.ok(occupancy.contains([
            0.5 + (x * 0.25) + (z * 0.25),
            y,
            0.5 + (z * 0.25) - (x * 0.25)
          ]), `${id} high step looking ${x},${z}, flipped ${flipY}`);
          assert.ok(!occupancy.contains([
            0.5 - (x * 0.25) + (z * 0.25),
            y,
            0.5 - (z * 0.25) - (x * 0.25)
          ]), `${id} low step looking ${x},${z}, flipped ${flipY}`);
        }
      }
    }
  });

  test("auto aligns an outer stair with its flipped slab-notch complement", () => {
    const shapes = BlockShapeRegistry.createDefault();
    const stair = shapes.get("stairCornerOuter");
    const notch = shapes.get("slabNotch");
    assert.ok(stair && notch);

    for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const camera = cameraLookingAt(x, -1, z);
      const stairTransform = new VoxelTransform(
        resolveBrushOrientation(camera, "auto", false, stair.id)
      );
      const notchTransform = new VoxelTransform(
        resolveBrushOrientation(camera, "auto", true, notch.id)
      );
      assert.ok(ShapeOccupancy.fromShape(stair, stairTransform).complements(
        ShapeOccupancy.fromShape(notch, notchTransform)
      ));
    }
  });

  test("returns an explicit mode untouched, whatever the camera does", () => {
    const camera = cameraLookingAt(0, 10, 10);
    for (const shapeId of ["stairCornerOuter", "stairCornerPeak", "slabNotch"]) {
      for (const mode of Object.values(VoxelRotation)) {
        assert.deepEqual(
          resolveBrushOrientation(camera, mode, false, shapeId),
          { rotation: mode, flipY: false }
        );
      }
    }
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

    for (const shapeId of ["cube", "ramp", "stair", "custom-shape"]) {
      for (const [index, [x, y, z]] of cases.entries()) {
        assert.strictEqual(
          resolveBrushOrientation(cameraLookingAt(x, y, z), "auto", false, shapeId).rotation,
          expected[index],
          `${shapeId} looking at ${x},${y},${z}`
        );
      }
    }
  });

  test("auto ignores the vertical part of the view direction", () => {
    assert.strictEqual(
      resolveBrushOrientation(cameraLookingAt(1, -20, 10), "auto", false).rotation,
      VoxelRotation.None
    );
  });

  test("auto favors the z axis on a perfect diagonal", () => {
    assert.strictEqual(
      resolveBrushOrientation(cameraLookingAt(10, 0, 10), "auto", false).rotation,
      VoxelRotation.None
    );
  });
});

describe("resolveBrushOrientation flip", () => {
  test("a forced flip wins over every mode", () => {
    assert.ok(resolveBrushOrientation(cameraLookingAt(0, -10, 1), "auto", true).flipY);
    assert.ok(resolveBrushOrientation(cameraLookingAt(0, -10, 1), VoxelRotation.None, true).flipY);
  });

  test("auto flips while the camera looks upwards", () => {
    for (const shapeId of ["cube", "stairCornerOuter", "stairCornerPeak"]) {
      assert.ok(resolveBrushOrientation(
        cameraLookingAt(0, 10, 1), "auto", false, shapeId
      ).flipY);
    }
  });

  test("auto leaves a downwards view unflipped", () => {
    assert.ok(!resolveBrushOrientation(cameraLookingAt(0, -10, 1), "auto", false).flipY);
  });

  test("an explicit rotation mode never flips on its own", () => {
    assert.ok(
      !resolveBrushOrientation(cameraLookingAt(0, 10, 1), VoxelRotation.CW90, false).flipY
    );
  });
});
