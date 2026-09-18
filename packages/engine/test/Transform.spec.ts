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
