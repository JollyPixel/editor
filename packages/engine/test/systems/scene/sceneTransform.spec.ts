// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  composeSceneTransform,
  readSceneTransform,
  writeSceneTransform
} from "../../../src/systems/scene/file/index.ts";

describe("Systems.readSceneTransform", () => {
  test("reads back the transform written to an object, then its rotated pose, in degrees", () => {
    const object = new THREE.Object3D();
    writeSceneTransform(object, {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 30, z: 0 },
      scale: { x: 2, y: 2, z: 2 }
    });

    const written = readSceneTransform(object);
    object.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const rotated = readSceneTransform(object);

    assert.deepEqual(written.position, { x: 1, y: 2, z: 3 });
    assert.ok(Math.abs(written.rotation.y - 30) < 1e-9);
    assert.deepEqual(written.scale, { x: 2, y: 2, z: 2 });
    assert.ok(Math.abs(rotated.rotation.x - 90) < 1e-9);
  });
});

describe("Systems.composeSceneTransform", () => {
  test("composes the matrix writeSceneTransform gives an object, which decomposes back", () => {
    const transform = {
      position: { x: 1, y: -2, z: 3 },
      rotation: { x: 10, y: 45, z: -30 },
      scale: { x: 2, y: 1, z: 0.5 }
    };
    const object = new THREE.Object3D();
    writeSceneTransform(object, transform);

    const matrix = composeSceneTransform(transform);

    const { elements } = object.matrix;
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
