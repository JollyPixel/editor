// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Transform,
  type QuaternionLike,
  type Vector3Like
} from "@jolly-pixel/ecs";

function assertQuaternionClose(
  actual: Readonly<QuaternionLike>,
  expected: Readonly<QuaternionLike>
): void {
  const actualQuaternion = new THREE.Quaternion().copy(actual);
  const expectedQuaternion = new THREE.Quaternion().copy(expected);
  assert.ok(
    Math.abs(actualQuaternion.length() - 1) < 1e-6 &&
    Math.abs(actualQuaternion.dot(expectedQuaternion)) > 1 - 1e-6,
    `expected ${actualQuaternion.toArray()} to match ${expectedQuaternion.toArray()}`
  );
}

function assertVectorClose(
  actual: Readonly<Vector3Like>,
  expected: Readonly<Vector3Like>
): void {
  const actualVector = new THREE.Vector3().copy(actual);
  assert.ok(
    actualVector.distanceTo(expected) < 1e-6,
    `expected ${actualVector.toArray()} to match ${[expected.x, expected.y, expected.z]}`
  );
}

function transformAt(
  position: Readonly<Vector3Like>
): Transform {
  const transform = new Transform();
  transform.local.position = position;

  return transform;
}

function createChild() {
  const parent = transformAt({ x: 2, y: -1, z: 4 });
  parent.local.eulerAngles = new THREE.Euler(0.3, 1.1, 0);
  const transform = transformAt({ x: 1, y: 2, z: 3 }).attach(parent);

  return {
    parent,
    transform
  };
}

describe("Transform three.js parity", () => {
  test("should apply euler angles like the matching quaternion", () => {
    const transform = new Transform();
    const euler = new THREE.Euler(0.1, 0.2, 0.3);

    transform.local.rotateEulerAngles(euler);

    assertQuaternionClose(
      transform.local.orientation,
      new THREE.Quaternion().setFromEuler(euler)
    );
  });

  test("should rotate globally before the current global orientation", () => {
    const { transform } = createChild();
    const before = new THREE.Quaternion().copy(transform.global.orientation);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.7, 0));

    transform.global.rotateEulerAngles(new THREE.Euler(0, 0.7, 0));

    assertQuaternionClose(
      transform.global.orientation,
      rotation.multiply(before)
    );
  });

  test("should place a global matrix under a moved parent", () => {
    const { transform } = createChild();
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(-3, 4, 8),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0)),
      new THREE.Vector3(1, 1, 1)
    );

    transform.global.matrix = matrix.elements;

    assertVectorClose(transform.global.position, new THREE.Vector3(-3, 4, 8));
  });

  test("should keep a global matrix it was given under a mirrored parent", () => {
    const { parent, transform } = createChild();
    parent.local.scale = { x: -1, y: 1, z: 1 };
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(-3, 4, 8),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.6, 0.4)),
      new THREE.Vector3(1, 1, 1)
    );

    transform.global.matrix = matrix.elements;

    const actual = transform.global.matrix;
    assert.ok(
      matrix.elements.every((value, index) => Math.abs(value - actual[index]) < 1e-6),
      `expected ${actual} to match ${matrix.elements}`
    );
  });

  test("should read a non-uniformly scaled global matrix like three.js", () => {
    const transform = new Transform();
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(1, -2, 3),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.8, -0.5)),
      new THREE.Vector3(2, 1, 0.5)
    );

    transform.global.matrix = matrix.elements;

    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, orientation, scale);
    assertQuaternionClose(transform.global.orientation, orientation);
    assertVectorClose(transform.local.scale, scale);
  });

  test("should read a mirrored global orientation like three.js", () => {
    const { parent, transform } = createChild();
    parent.local.scale = { x: -1, y: 1, z: 1 };

    const orientation = new THREE.Quaternion();
    new THREE.Matrix4()
      .fromArray(transform.global.matrix)
      .decompose(new THREE.Vector3(), orientation, new THREE.Vector3());
    assertQuaternionClose(transform.global.orientation, orientation);
  });

  for (const [name, target, up] of [
    ["its own position", { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 1 }],
    ["a point along its up axis", { x: 1, y: 7, z: 3 }, { x: 0, y: 1, z: 0 }],
    ["a point along a +Z up axis", { x: 1, y: 2, z: 9 }, { x: 0, y: 0, z: 1 }]
  ] as const) {
    test(`should look at ${name} like three.js`, () => {
      const transform = transformAt({ x: 1, y: 2, z: 3 });

      transform.lookAt(target, up);

      const expected = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(
          new THREE.Vector3(1, 2, 3),
          new THREE.Vector3().copy(target),
          new THREE.Vector3().copy(up)
        )
      );
      assertQuaternionClose(transform.global.orientation, expected);
    });
  }
});
