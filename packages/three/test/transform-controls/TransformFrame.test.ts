// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { TransformFrame } from "#src/transform-controls/TransformFrame.ts";

// CONSTANTS
const kQuarterTurn = Math.PI / 2;

function createScene(): {
  parent: THREE.Object3D;
  target: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
} {
  const parent = new THREE.Object3D();
  parent.rotation.y = kQuarterTurn;
  const target = new THREE.Object3D();
  target.position.set(2, 0, 0);
  target.rotation.x = kQuarterTurn;
  parent.add(target);
  parent.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 5, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  return { parent, target, camera };
}

function closeTo(
  actual: THREE.Quaternion,
  expected: THREE.Quaternion
): boolean {
  return Math.abs(actual.dot(expected)) > 1 - 1e-9;
}

describe("orientation", () => {
  test("resolves each named orientation", () => {
    const { parent, target, camera } = createScene();
    const frame = new TransformFrame();
    const resolved = new THREE.Quaternion();

    frame.resolveQuaternion(target, camera, "translate", resolved);
    assert.ok(closeTo(resolved, new THREE.Quaternion()));

    frame.orientation = "local";
    frame.resolveQuaternion(target, camera, "translate", resolved);
    assert.ok(closeTo(
      resolved,
      target.getWorldQuaternion(new THREE.Quaternion())
    ));

    frame.orientation = "parent";
    frame.resolveQuaternion(target, camera, "translate", resolved);
    assert.ok(closeTo(resolved, parent.quaternion));

    frame.orientation = "view";
    frame.resolveQuaternion(target, camera, "translate", resolved);
    assert.ok(closeTo(resolved, camera.quaternion));
  });

  test("uses the world axes for a parentless target in parent orientation", () => {
    const { camera } = createScene();
    const frame = new TransformFrame();
    frame.orientation = "parent";
    const orphan = new THREE.Object3D();
    orphan.rotation.z = 1;

    assert.ok(closeTo(
      frame.resolveQuaternion(
        orphan,
        camera,
        "rotate",
        new THREE.Quaternion(1, 0, 0, 0)
      ),
      new THREE.Quaternion()
    ));
  });

  test("always scales along the target's own axes", () => {
    const { target, camera } = createScene();
    const frame = new TransformFrame();
    frame.orientation = "world";

    assert.ok(closeTo(
      frame.resolveQuaternion(
        target,
        camera,
        "scale",
        new THREE.Quaternion()
      ),
      target.getWorldQuaternion(new THREE.Quaternion())
    ));
  });

  test("normalizes and copies a custom quaternion", () => {
    const { target, camera } = createScene();
    const frame = new TransformFrame();
    const custom = {
      x: 0,
      y: 2,
      z: 0,
      w: 2
    };
    frame.orientation = custom;
    custom.y = 100;

    const resolved = frame.resolveQuaternion(
      target,
      camera,
      "translate",
      new THREE.Quaternion()
    );
    assert.ok(closeTo(
      resolved,
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        kQuarterTurn
      )
    ));

    const read = frame.orientation;
    assert.ok(read instanceof THREE.Quaternion);
    read.set(1, 0, 0, 0);
    assert.ok(closeTo(
      frame.resolveQuaternion(
        target,
        camera,
        "translate",
        new THREE.Quaternion()
      ),
      resolved
    ));
  });

  test("rejects unknown names and degenerate quaternions", () => {
    const frame = new TransformFrame();

    assert.throws(
      () => {
        frame.orientation = "screen" as "view";
      },
      TypeError
    );
    assert.throws(
      () => {
        frame.orientation = { x: 0, y: 0, z: 0, w: 0 };
      },
      RangeError
    );
    assert.throws(
      () => {
        frame.orientation = { x: Number.NaN, y: 0, z: 0, w: 1 };
      },
      RangeError
    );
  });
});

describe("pivot", () => {
  test("defaults to the target world position", () => {
    const { target } = createScene();
    const origin = new TransformFrame().resolveOrigin(
      target,
      new THREE.Vector3()
    );

    assert.ok(
      origin.distanceTo(target.getWorldPosition(new THREE.Vector3())) < 1e-9
    );
  });

  test("reads a vector as a point in the target's local space", () => {
    const { target } = createScene();
    const frame = new TransformFrame();
    const point = new THREE.Vector3(0, 1, 0);
    frame.pivot = point;
    point.set(9, 9, 9);

    const origin = frame.resolveOrigin(target, new THREE.Vector3());
    const expected = target.localToWorld(new THREE.Vector3(0, 1, 0));
    assert.ok(origin.distanceTo(expected) < 1e-9);
  });

  test("follows an object in world space", () => {
    const { target } = createScene();
    const frame = new TransformFrame();
    const marker = new THREE.Object3D();
    marker.position.set(4, 5, 6);
    marker.updateMatrixWorld(true);
    frame.pivot = marker;

    assert.deepEqual(
      frame.resolveOrigin(target, new THREE.Vector3()).toArray(),
      [4, 5, 6]
    );
    assert.equal(frame.pivot, marker);
  });

  test("rejects unknown names and non-finite points", () => {
    const frame = new TransformFrame();

    assert.throws(
      () => {
        frame.pivot = "center" as "origin";
      },
      TypeError
    );
    assert.throws(
      () => {
        frame.pivot = { x: Number.POSITIVE_INFINITY, y: 0, z: 0 };
      },
      RangeError
    );
  });
});
