// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Import Internal Dependencies
import ModelManager from "#src/features/groups/ModelManager.ts";

function createModelManager(): ModelManager {
  const scene = new THREE.Scene();
  const transformControl = {
    attach: () => undefined,
    detach: () => undefined,
    getHelper: () => new THREE.Object3D()
  } as unknown as TransformControls;

  return new ModelManager({ scene, transformControl });
}

describe("ModelManager.duplicateGroup", () => {
  test("returns null when the source uuid does not exist", () => {
    const manager = createModelManager();

    assert.equal(manager.duplicateGroup("missing"), null);
  });

  test("clones transform, size and scale from the source into a new group", () => {
    const manager = createModelManager();
    const source = manager.addGroup({
      pos: new THREE.Vector3(1, 2, 3),
      pivotPos: new THREE.Vector3(0.5, 0, 0),
      size: new THREE.Vector3(2, 3, 4),
      scale: new THREE.Vector3(1, 2, 1),
      name: "Torso"
    });
    source.setRotation(new THREE.Euler(0, Math.PI / 4, 0));

    const duplicate = manager.duplicateGroup(source.getGroupUUID());

    assert.ok(duplicate);
    assert.notEqual(duplicate.getGroupUUID(), source.getGroupUUID());
    assert.equal(duplicate.name, "Torso");
    assert.deepStrictEqual(duplicate.getPosition(), source.getPosition());
    assert.deepStrictEqual(duplicate.getPivotOffset(), source.getPivotOffset());
    assert.deepStrictEqual(duplicate.getSize(), source.getSize());
    assert.deepStrictEqual(duplicate.getScale(), source.getScale());
    assert.equal(duplicate.getRotation().y, source.getRotation().y);
  });

  test("uses the provided name instead of the source's name", () => {
    const manager = createModelManager();
    const source = manager.addGroup({ name: "Torso" });

    const duplicate = manager.duplicateGroup(source.getGroupUUID(), "Torso Copy");

    assert.ok(duplicate);
    assert.equal(duplicate.name, "Torso Copy");
  });
});

describe("ModelManager.reparentLocal", () => {
  test("keeps the child's local position unchanged, unlike reparent", () => {
    const manager = createModelManager();
    const parent = manager.addGroup({ pos: new THREE.Vector3(10, 0, 0) });
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 1, 1) });

    manager.reparentLocal(child.getGroupUUID(), parent.getGroupUUID());

    assert.deepStrictEqual(child.getPosition(), new THREE.Vector3(1, 1, 1));
    assert.deepStrictEqual(child.getPositionWorld(), new THREE.Vector3(11, 1, 1));
  });

  test("moves the child back to the scene root without changing its local position", () => {
    const manager = createModelManager();
    const parent = manager.addGroup({ pos: new THREE.Vector3(10, 0, 0) });
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 1, 1) });
    manager.reparentLocal(child.getGroupUUID(), parent.getGroupUUID());

    manager.reparentLocal(child.getGroupUUID(), null);

    assert.deepStrictEqual(child.getPosition(), new THREE.Vector3(1, 1, 1));
  });
});
