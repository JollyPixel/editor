// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor, Transform } from "../src/index.ts";
import { SceneManager } from "../src/systems/scene/SceneManager.ts";

function assertQuaternionClose(
  actual: THREE.Quaternion,
  expected: THREE.Quaternion
): void {
  assert.ok(
    Math.abs(actual.dot(expected)) > 1 - 1e-6,
    `expected ${actual.toArray()} to match ${expected.toArray()}`
  );
}

function assertVectorClose(
  actual: THREE.Vector3,
  expected: THREE.Vector3
): void {
  assert.ok(
    actual.distanceTo(expected) < 1e-6,
    `expected ${actual.toArray()} to match ${expected.toArray()}`
  );
}

function createChild() {
  const parent = new THREE.Group();
  parent.position.set(2, -1, 4);
  parent.quaternion.setFromEuler(new THREE.Euler(0.3, 1.1, 0));
  const object = new THREE.Group();
  object.position.set(1, 2, 3);
  parent.add(object);
  parent.updateMatrixWorld();

  return {
    parent,
    transform: new Transform(object)
  };
}

describe("Transform", () => {
  test("should read back the global orientation it was given", () => {
    const parent = new THREE.Group();
    parent.quaternion.setFromEuler(new THREE.Euler(0.3, 1.1, 0));
    const object = new THREE.Group();
    parent.add(object);
    const transform = new Transform(object);
    const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0.2, 0.9));

    transform.setGlobalOrientation(target);

    assertQuaternionClose(transform.getGlobalOrientation(), target);
  });

  test("should apply euler angles like the matching quaternion", () => {
    const object = new THREE.Group();
    new THREE.Group().add(object);
    const transform = new Transform(object);
    const euler = new THREE.Euler(0.1, 0.2, 0.3);

    transform.rotateLocalEulerAngles(euler);

    assertQuaternionClose(
      transform.getLocalOrientation(),
      new THREE.Quaternion().setFromEuler(euler)
    );
  });

  test("should face another transform under a rotated parent", () => {
    const { transform } = createChild();
    const target = new THREE.Group();
    target.position.set(5, 3, -2);
    target.updateMatrixWorld();

    transform.lookAt(new Transform(target));

    const expected = new THREE.Vector3(5, 3, -2)
      .sub(transform.getGlobalPosition())
      .normalize();
    assertVectorClose(transform.getForward(), expected);
  });

  test("should look towards a direction like looking at the matching point", () => {
    const { transform } = createChild();
    const reference = createChild().transform;
    const direction = new THREE.Vector3(1, -2, 0.5);

    transform.lookTowards(direction);
    reference.lookAt(reference.getGlobalPosition().sub(direction));

    assertQuaternionClose(
      transform.getGlobalOrientation(),
      reference.getGlobalOrientation()
    );
  });

  test("should rotate globally before the current global orientation", () => {
    const { transform } = createChild();
    const before = transform.getGlobalOrientation();
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.7, 0));

    transform.rotateGlobalEulerAngles(new THREE.Euler(0, 0.7, 0));

    assertQuaternionClose(
      transform.getGlobalOrientation(),
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

    transform.setGlobalMatrix(matrix.clone());

    assertVectorClose(transform.getGlobalPosition(), new THREE.Vector3(-3, 4, 8));
  });

  test("should move along its own orientation", () => {
    const object = new THREE.Group();
    new THREE.Group().add(object);
    const transform = new Transform(object);
    transform.setLocalEulerAngles(new THREE.Euler(0, Math.PI / 2, 0));

    transform.moveOriented({ x: 0, y: 0, z: -1 });

    assertVectorClose(transform.getLocalPosition(), new THREE.Vector3(-1, 0, 0));
  });

  test("should measure the distance to another transform", () => {
    const { transform } = createChild();
    const other = new THREE.Group();
    other.position.copy(transform.getGlobalPosition()).add(new THREE.Vector3(3, 4, 0));
    other.updateMatrixWorld();

    assert.ok(Math.abs(transform.distanceTo(new Transform(other)) - 5) < 1e-6);
  });
});

describe("Actor.setParent", () => {
  test("should keep the world position when reparenting", () => {
    const world = { sceneManager: new SceneManager() };
    const parent = new Actor(world as any, { name: "parent" });
    parent.transform.setLocalPosition({ x: 10, y: 0, z: 0 });
    const child = new Actor(world as any, { name: "child" });
    child.transform.setLocalPosition({ x: 1, y: 2, z: 3 });

    child.setParent(parent);

    assert.deepEqual(child.transform.getGlobalPosition().toArray(), [1, 2, 3]);
    assert.deepEqual(child.transform.getLocalPosition().toArray(), [-9, 2, 3]);
    assert.ok(parent.children.includes(child));
    assert.strictEqual(child.object3D.parent, parent.object3D);
    assert.ok(!world.sceneManager.tree.children.includes(child));
  });

  test("should move an actor back to the scene root", () => {
    const world = { sceneManager: new SceneManager() };
    const parent = new Actor(world as any, { name: "parent" });
    parent.transform.setLocalPosition({ x: 10, y: 0, z: 0 });
    const child = new Actor(world as any, { name: "child", parent });

    child.setParent(null);

    assert.strictEqual(child.parent, null);
    assert.strictEqual(child.object3D.parent, world.sceneManager.getSource());
    assert.ok(world.sceneManager.tree.children.includes(child));
    assert.deepEqual(child.transform.getGlobalPosition().toArray(), [10, 0, 0]);
  });
});
