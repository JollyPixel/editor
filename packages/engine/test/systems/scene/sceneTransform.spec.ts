// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  composeSceneTransform,
  localSceneTransform,
  readSceneTransform,
  writeSceneTransform
} from "../../../src/core/systems/scene/file/index.ts";
import { Transform } from "../../../src/core/actor/Transform.ts";

describe("Systems.localSceneTransform", () => {
  test("reads back the transform written to a transform, then its rotated pose, in degrees", () => {
    const transform = new Transform();
    writeSceneTransform(transform, {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 30, z: 0 },
      scale: { x: 2, y: 2, z: 2 }
    });

    const written = localSceneTransform(transform);
    transform.setLocalOrientation(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    );
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

    const { elements } = transform.getGlobalMatrix();
    assert.ok(matrix.elements.every((value, index) => Math.abs(value - elements[index]) < 1e-9));
    const pose = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3()
    };
    matrix.decompose(pose.position, pose.quaternion, pose.scale);
    assert.ok(Math.abs(readSceneTransform(pose).rotation.z + 30) < 1e-9);
  });
});
