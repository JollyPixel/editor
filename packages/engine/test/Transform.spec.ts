// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor, Transform } from "../src/index.ts";
import { SceneManager } from "../src/core/systems/scene/SceneManager.ts";
import { ThreeSceneGraph } from "../src/three/scene/ThreeSceneGraph.ts";

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

function transformAt(
  position: THREE.Vector3Like
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

describe("Transform", () => {
  test("should read back the global orientation it was given", () => {
    const parent = new Transform();
    parent.local.eulerAngles = new THREE.Euler(0.3, 1.1, 0);
    const transform = new Transform().attach(parent);
    const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0.2, 0.9));

    transform.global.orientation = target;

    assertQuaternionClose(transform.global.orientation, target);
  });

  test("should apply euler angles like the matching quaternion", () => {
    const transform = new Transform();
    const euler = new THREE.Euler(0.1, 0.2, 0.3);

    transform.local.rotateEulerAngles(euler);

    assertQuaternionClose(
      transform.local.orientation,
      new THREE.Quaternion().setFromEuler(euler)
    );
  });

  test("should face another transform under a rotated parent", () => {
    const { transform } = createChild();
    const target = transformAt({ x: 5, y: 3, z: -2 });

    transform.lookAt(target);

    const expected = new THREE.Vector3(5, 3, -2)
      .sub(transform.global.position)
      .normalize();
    assertVectorClose(transform.global.forward, expected);
  });

  test("should look towards a direction like looking at the matching point", () => {
    const { transform } = createChild();
    const reference = createChild().transform;
    const direction = new THREE.Vector3(1, -2, 0.5);

    transform.lookTowards(direction);
    reference.lookAt(reference.global.position.sub(direction));

    assertQuaternionClose(
      transform.global.orientation,
      reference.global.orientation
    );
  });

  test("should rotate globally before the current global orientation", () => {
    const { transform } = createChild();
    const before = transform.global.orientation.clone();
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

    transform.global.matrix = matrix.clone();

    assertVectorClose(transform.global.position, new THREE.Vector3(-3, 4, 8));
  });

  test("should move along its own orientation", () => {
    const transform = new Transform();
    transform.local.eulerAngles = new THREE.Euler(0, Math.PI / 2, 0);

    transform.moveOriented({ x: 0, y: 0, z: -1 });

    assertVectorClose(transform.local.position, new THREE.Vector3(-1, 0, 0));
  });

  for (const [method, expected] of [
    ["moveForward", new THREE.Vector3(10, 0, -2)],
    ["moveRight", new THREE.Vector3(12, 0, 0)],
    ["moveUp", new THREE.Vector3(10, 2, 0)]
  ] as const) {
    test(`should ${method} from its current position`, () => {
      const transform = transformAt({ x: 10, y: 0, z: 0 });

      transform[method](2);

      assertVectorClose(transform.global.position, expected);
    });
  }

  test("should not move when a value read from it is mutated", () => {
    const { transform } = createChild();
    const local = transform.local.position.toArray();
    const world = transform.global.position.toArray();

    transform.local.position.add(new THREE.Vector3(5, 5, 5));
    transform.global.position.set(0, 0, 0);
    // @ts-expect-error
    transform.local.position.x = 9;

    assert.deepEqual(transform.local.position.toArray(), local);
    assert.deepEqual(transform.global.position.toArray(), world);
  });

  test("should be hidden in the hierarchy when an ancestor is hidden", () => {
    const { parent, transform } = createChild();

    assert.strictEqual(transform.visibleInHierarchy, true);
    parent.visible = false;
    assert.strictEqual(transform.visibleInHierarchy, false);
  });

  test("should measure the distance to another transform", () => {
    const { transform } = createChild();
    const other = transformAt(
      transform.global.position.add(new THREE.Vector3(3, 4, 0))
    );

    assert.ok(Math.abs(transform.distanceTo(other) - 5) < 1e-6);
  });

  test("should follow an ancestor moved after its global position was read", () => {
    const grandparent = new Transform();
    const parent = new Transform().attach(grandparent);
    const transform = transformAt({ x: 1, y: 0, z: 0 }).attach(parent);
    assertVectorClose(transform.global.position, new THREE.Vector3(1, 0, 0));

    grandparent.local.position = { x: 0, y: 5, z: 0 };
    assertVectorClose(parent.global.position, new THREE.Vector3(0, 5, 0));
    grandparent.local.move({ x: 2, y: 0, z: 0 });

    assertVectorClose(transform.global.position, new THREE.Vector3(3, 5, 0));
  });

  test("should offset its global pose by the socket it is seated on", () => {
    const parent = transformAt({ x: 10, y: 0, z: 0 });
    const socket = {
      matrix: new THREE.Matrix4().makeTranslation(0, 3, 0)
    };
    const transform = transformAt({ x: 1, y: 0, z: 0 })
      .attach(parent)
      .seat(socket);

    assertVectorClose(transform.global.position, new THREE.Vector3(11, 3, 0));

    transform.global.position = { x: 0, y: 0, z: 0 };
    assertVectorClose(transform.local.position, new THREE.Vector3(-10, -3, 0));
  });
});

describe("Actor.reparent", () => {
  test("should keep the world position when reparenting", () => {
    const world = { sceneManager: new SceneManager(new ThreeSceneGraph()) };
    const parent = new Actor(world as any, { name: "parent" });
    parent.transform.local.position = { x: 10, y: 0, z: 0 };
    const child = new Actor(world as any, { name: "child" });
    child.transform.local.position = { x: 1, y: 2, z: 3 };

    child.reparent(parent);

    assert.deepEqual(child.transform.global.position.toArray(), [1, 2, 3]);
    assert.deepEqual(child.transform.local.position.toArray(), [-9, 2, 3]);
    assert.ok(parent.children.includes(child));
    assert.strictEqual(child.node.object3D.parent, parent.node.object3D);
    assert.ok(!world.sceneManager.tree.children.includes(child));
  });

  test("should move an actor back to the scene root", () => {
    const world = { sceneManager: new SceneManager(new ThreeSceneGraph()) };
    const parent = new Actor(world as any, { name: "parent" });
    parent.transform.local.position = { x: 10, y: 0, z: 0 };
    const child = new Actor(world as any, { name: "child", parent });

    child.reparent(null);

    assert.strictEqual(child.parent, null);
    assert.strictEqual(child.node.object3D.parent, (world as any).sceneManager.graph.scene);
    assert.ok(world.sceneManager.tree.children.includes(child));
    assert.deepEqual(child.transform.global.position.toArray(), [10, 0, 0]);
  });
});
