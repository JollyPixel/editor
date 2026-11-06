// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { SceneTransformJSON } from "@jolly-pixel/asset.scene/client";
import { Mixed } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { transformPatch } from "../../src/features/inspector/transformPatch.ts";

// CONSTANTS
const kCurrent: SceneTransformJSON = {
  position: { x: 1, y: 2, z: 3 },
  rotation: { x: 0, y: 200, z: 0 },
  scale: { x: 1, y: 1.2, z: 1 }
};

describe("transformPatch", () => {
  test("patches only the row the transform reports", () => {
    const patch = transformPatch({
      field: "position",
      value: {
        ...kCurrent,
        position: { x: 5, y: 2, z: 3 },
        scale: { x: 9, y: 9, z: 9 }
      }
    }, kCurrent);

    assert.deepEqual(patch, {
      position: { x: 5, y: 2, z: 3 }
    });
  });

  test("patches the reported row even when its value did not change", () => {
    const patch = transformPatch({
      field: "scale",
      value: { ...kCurrent }
    }, kCurrent);

    assert.deepEqual(patch, {
      scale: { x: 1, y: 1.2, z: 1 }
    });
  });

  test("keeps current axes the row reports as mixed", () => {
    const patch = transformPatch({
      field: "rotation",
      value: {
        ...kCurrent,
        rotation: { x: 45, y: Mixed, z: 0 }
      }
    }, kCurrent);

    assert.deepEqual(patch, {
      rotation: { x: 45, y: 200, z: 0 }
    });
  });
});
