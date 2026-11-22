// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  composeSceneTransform,
  localSceneTransform,
  writeSceneTransform
} from "../../../src/systems/scene/file/index.ts";
import { Transform } from "../../../src/actor/transform/Transform.ts";

describe("Systems.localSceneTransform", () => {
  test("reads back the transform written to a transform, then its rotated pose, in degrees", () => {
    const transform = new Transform();
    writeSceneTransform(transform, {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 30, z: 0 },
      scale: { x: 2, y: 2, z: 2 }
    });

    const written = localSceneTransform(transform);
    transform.local.orientation = {
      x: Math.SQRT1_2,
      y: 0,
      z: 0,
      w: Math.SQRT1_2
    };
    const rotated = localSceneTransform(transform);

    assert.deepEqual(written.position, { x: 1, y: 2, z: 3 });
    assert.ok(Math.abs(written.rotation.y - 30) < 1e-9);
    assert.deepEqual(written.scale, { x: 2, y: 2, z: 2 });
    assert.ok(Math.abs(rotated.rotation.x - 90) < 1e-9);
  });
});

describe("Systems.composeSceneTransform", () => {
  test("composes the matrix writeSceneTransform gives a transform, which decomposes back", () => {
    const file = {
      position: { x: 1, y: -2, z: 3 },
      rotation: { x: 10, y: 45, z: -30 },
      scale: { x: 2, y: 1, z: 0.5 }
    };
    const transform = new Transform();
    writeSceneTransform(transform, file);

    const matrix = composeSceneTransform(file);

    const actual = transform.global.matrix;
    assert.ok(matrix.every((value, index) => Math.abs(value - actual[index]) < 1e-9));
    const decoded = new Transform();
    decoded.global.matrix = matrix;
    assert.ok(Math.abs(localSceneTransform(decoded).rotation.z + 30) < 1e-9);
  });
});
