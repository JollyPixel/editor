// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Import Internal Dependencies
import ModelManager from "#src/features/groups/ModelManager.ts";
import type { ModelHookEvent } from "#src/features/groups/hooks.ts";
import { snapshotTransform } from "#src/features/groups/transformCodec.ts";

function createModelManager(): ModelManager {
  const scene = new THREE.Scene();
  const transformControl = {
    attach: () => undefined,
    detach: () => undefined,
    getHelper: () => new THREE.Object3D()
  } as unknown as TransformControls;

  return new ModelManager({ scene, transformControl });
}

function watch(
  manager: ModelManager
): ModelHookEvent[] {
  const events: ModelHookEvent[] = [];
  manager.onModelUpdated = (event) => events.push(event);

  return events;
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

describe("ModelManager.mirrorGroups", () => {
  test("does nothing for uuids that don't exist", () => {
    const manager = createModelManager();

    assert.doesNotThrow(() => {
      manager.mirrorGroups(["missing"], { x: true, y: false, z: false });
    });
  });

  test("mirrors a group's world position along the selected axis", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ pos: new THREE.Vector3(2, 3, 4) });

    manager.mirrorGroups([group.getGroupUUID()], { x: true, y: false, z: false });

    assert.deepStrictEqual(group.getPositionWorld(), new THREE.Vector3(-2, 3, 4));
  });

  test("mirrors every requested axis at once", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ pos: new THREE.Vector3(2, 3, 4) });

    manager.mirrorGroups([group.getGroupUUID()], { x: true, y: true, z: true });

    assert.deepStrictEqual(group.getPositionWorld(), new THREE.Vector3(-2, -3, -4));
  });

  test("mirrors each group from its own world transform, not a mirrored parent's", () => {
    const manager = createModelManager();
    const parent = manager.addGroup({ pos: new THREE.Vector3(2, 0, 0) });
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 0, 0) });
    manager.reparentLocal(child.getGroupUUID(), parent.getGroupUUID());
    assert.deepStrictEqual(child.getPositionWorld(), new THREE.Vector3(3, 0, 0));

    manager.mirrorGroups(
      [parent.getGroupUUID(), child.getGroupUUID()],
      { x: true, y: false, z: false }
    );

    assert.deepStrictEqual(parent.getPositionWorld(), new THREE.Vector3(-2, 0, 0));
    assert.deepStrictEqual(child.getPositionWorld(), new THREE.Vector3(-3, 0, 0));
  });

  test("emits a single group-transformed event carrying flipAxes per mirrored group", () => {
    const manager = createModelManager();
    const a = manager.addGroup({ pos: new THREE.Vector3(1, 0, 0) });
    const b = manager.addGroup({ pos: new THREE.Vector3(0, 1, 0) });
    const events = watch(manager);

    manager.mirrorGroups([a.getGroupUUID(), b.getGroupUUID()], { x: true, y: false, z: false });

    assert.deepEqual(events.map((event) => event.action), [
      "group-transformed",
      "group-transformed"
    ]);
    assert.deepEqual(
      events.map((event) => (event.action === "group-transformed" ? event.flipAxes : undefined)),
      [
        { x: true, y: false, z: false },
        { x: true, y: false, z: false }
      ]
    );
  });

  test("records the mirror axes so they can be read back through getFlipAxes", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ pos: new THREE.Vector3(1, 0, 0) });

    manager.mirrorGroups([group.getGroupUUID()], { x: true, y: false, z: true });

    assert.deepEqual(manager.getFlipAxes(group.getGroupUUID()), { x: true, y: false, z: true });
  });
});

describe("ModelManager.applyRemoteCommand", () => {
  test("applies flipAxes from a group-transformed command without re-emitting a network event", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ name: "Block" });
    const events = watch(manager);

    manager.applyRemoteCommand({
      action: "group-transformed",
      uuid: group.getGroupUUID(),
      transform: snapshotTransform(group),
      flipAxes: { x: true, y: false, z: false }
    });

    assert.deepEqual(manager.getFlipAxes(group.getGroupUUID()), { x: true, y: false, z: false });
    assert.deepEqual(events, []);
  });

  test("leaves flipAxes untouched when a group-transformed command omits it", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ name: "Block" });
    manager.mirrorGroups([group.getGroupUUID()], { x: true, y: false, z: false });

    manager.applyRemoteCommand({
      action: "group-transformed",
      uuid: group.getGroupUUID(),
      transform: snapshotTransform(group)
    });

    assert.deepEqual(manager.getFlipAxes(group.getGroupUUID()), { x: true, y: false, z: false });
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

describe("ModelManager.reparentAtParentPosition", () => {
  test("moves the child to the parent's world position before reparenting", () => {
    const manager = createModelManager();
    const parent = manager.addGroup({ pos: new THREE.Vector3(10, 5, -2) });
    const child = manager.addGroup({ pos: new THREE.Vector3(0, 0, 0) });

    manager.reparentAtParentPosition(child.getGroupUUID(), parent.getGroupUUID());

    assert.deepStrictEqual(child.getPositionWorld(), new THREE.Vector3(10, 5, -2));
    assert.deepStrictEqual(child.getPosition(), new THREE.Vector3(0, 0, 0));
  });

  test("does nothing when the child or parent uuid does not exist", () => {
    const manager = createModelManager();
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 1, 1) });

    assert.doesNotThrow(
      () => manager.reparentAtParentPosition(child.getGroupUUID(), "missing")
    );
    assert.deepStrictEqual(child.getPositionWorld(), new THREE.Vector3(1, 1, 1));
  });
});

describe("ModelManager.onModelUpdated", () => {
  test("fires group-added with the group's uuid, name and transform", () => {
    const manager = createModelManager();
    const events = watch(manager);

    const group = manager.addGroup({ name: "Torso", pos: new THREE.Vector3(1, 2, 3) });

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      action: "group-added",
      uuid: group.getGroupUUID(),
      name: "Torso",
      transform: {
        position: { x: 1, y: 2, z: 3 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });
  });

  test("carries the source's rotation on a duplicate's group-added event", () => {
    const manager = createModelManager();
    const source = manager.addGroup({ name: "Torso" });
    source.setRotation(new THREE.Euler(0, Math.PI / 4, 0));
    const events = watch(manager);

    manager.duplicateGroup(source.getGroupUUID());

    assert.equal(events.length, 1);
    assert.equal(events[0].action, "group-added");
    assert.equal(
      (events[0] as Extract<ModelHookEvent, { action: "group-added"; }>).transform.rotation.y,
      Math.PI / 4
    );
  });

  test("fires group-removed with the removed uuid", () => {
    const manager = createModelManager();
    const group = manager.addGroup();
    const events = watch(manager);

    manager.removeGroup(group);

    assert.deepEqual(events, [{ action: "group-removed", uuid: group.getGroupUUID() }]);
  });

  test("fires group-renamed and applies the name", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ name: "Block" });
    const events = watch(manager);

    manager.renameGroup(group.getGroupUUID(), "Torso");

    assert.equal(group.name, "Torso");
    assert.deepEqual(events, [{
      action: "group-renamed",
      uuid: group.getGroupUUID(),
      name: "Torso"
    }]);
  });

  test("fires group-reparented with the resulting local transform", () => {
    const manager = createModelManager();
    const parent = manager.addGroup({ pos: new THREE.Vector3(10, 0, 0) });
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 1, 1) });
    const events = watch(manager);

    manager.reparent(child.getGroupUUID(), parent.getGroupUUID());

    assert.equal(events.length, 1);
    const event = events[0] as Extract<ModelHookEvent, { action: "group-reparented"; }>;
    assert.equal(event.action, "group-reparented");
    assert.equal(event.parentUuid, parent.getGroupUUID());
    assert.deepEqual(event.transform.position, { x: -9, y: 1, z: 1 });
  });

  test("fires group-reparented-local without a transform", () => {
    const manager = createModelManager();
    const parent = manager.addGroup({ pos: new THREE.Vector3(10, 0, 0) });
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 1, 1) });
    const events = watch(manager);

    manager.reparentLocal(child.getGroupUUID(), parent.getGroupUUID());

    assert.deepEqual(events, [{
      action: "group-reparented-local",
      uuid: child.getGroupUUID(),
      parentUuid: parent.getGroupUUID()
    }]);
  });

  test("commitGroupTransform fires group-transformed with the current transform", () => {
    const manager = createModelManager();
    const group = manager.addGroup();
    group.setPosition(new THREE.Vector3(5, 6, 7));
    const events = watch(manager);

    manager.commitGroupTransform(group.getGroupUUID());

    assert.equal(events.length, 1);
    const event = events[0] as Extract<ModelHookEvent, { action: "group-transformed"; }>;
    assert.deepEqual(event.transform.position, { x: 5, y: 6, z: 7 });
  });

  test("commitGroupTransform does nothing for an unknown uuid", () => {
    const manager = createModelManager();
    const events = watch(manager);

    manager.commitGroupTransform("missing");

    assert.deepEqual(events, []);
  });
});

describe("ModelManager.silently", () => {
  test("suppresses onModelUpdated for the duration of the callback", () => {
    const manager = createModelManager();
    const events = watch(manager);

    manager.silently(() => {
      manager.addGroup({ name: "Block" });
    });

    assert.deepEqual(events, []);
  });

  test("restores emission afterwards, even if the callback throws", () => {
    const manager = createModelManager();
    const events = watch(manager);

    assert.throws(() => {
      manager.silently(() => {
        throw new Error("boom");
      });
    });

    manager.addGroup({ name: "Block" });
    assert.equal(events.length, 1);
  });
});

describe("ModelManager.applyRemoteCommand", () => {
  test("group-added creates a group under the given uuid without re-emitting", () => {
    const manager = createModelManager();
    const events = watch(manager);

    manager.applyRemoteCommand({
      action: "group-added",
      uuid: "remote-uuid",
      name: "Torso",
      transform: {
        position: { x: 1, y: 2, z: 3 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });

    const group = manager.getGroupByUUID("remote-uuid");
    assert.ok(group);
    assert.equal(group.name, "Torso");
    assert.deepStrictEqual(group.getPosition(), new THREE.Vector3(1, 2, 3));
    assert.deepEqual(events, []);
  });

  test("group-added is a no-op when the uuid already exists", () => {
    const manager = createModelManager();
    manager.applyRemoteCommand({
      action: "group-added",
      uuid: "remote-uuid",
      name: "Torso",
      transform: {
        position: { x: 0, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });

    manager.applyRemoteCommand({
      action: "group-added",
      uuid: "remote-uuid",
      name: "Duplicate",
      transform: {
        position: { x: 9, y: 9, z: 9 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });

    assert.equal(manager.getGroups().length, 1);
    assert.equal(manager.getGroupByUUID("remote-uuid")?.name, "Torso");
  });

  test("group-removed removes the matching group", () => {
    const manager = createModelManager();
    const group = manager.addGroup();
    const uuid = group.getGroupUUID();
    const events = watch(manager);

    manager.applyRemoteCommand({ action: "group-removed", uuid });

    assert.equal(manager.getGroupByUUID(uuid), undefined);
    assert.deepEqual(events, []);
  });

  test("group-renamed renames the matching group", () => {
    const manager = createModelManager();
    const group = manager.addGroup({ name: "Block" });
    const events = watch(manager);

    manager.applyRemoteCommand({
      action: "group-renamed",
      uuid: group.getGroupUUID(),
      name: "Torso"
    });

    assert.equal(group.name, "Torso");
    assert.deepEqual(events, []);
  });

  test("group-reparented moves the group and applies the given transform", () => {
    const manager = createModelManager();
    const parent = manager.addGroup();
    const child = manager.addGroup({ pos: new THREE.Vector3(1, 1, 1) });
    const events = watch(manager);

    manager.applyRemoteCommand({
      action: "group-reparented",
      uuid: child.getGroupUUID(),
      parentUuid: parent.getGroupUUID(),
      transform: {
        position: { x: -9, y: 1, z: 1 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });

    assert.deepStrictEqual(child.getPosition(), new THREE.Vector3(-9, 1, 1));
    assert.deepEqual(events, []);
  });

  test("group-transformed applies the given transform", () => {
    const manager = createModelManager();
    const group = manager.addGroup();
    const events = watch(manager);

    manager.applyRemoteCommand({
      action: "group-transformed",
      uuid: group.getGroupUUID(),
      transform: {
        position: { x: 4, y: 5, z: 6 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });

    assert.deepStrictEqual(group.getPosition(), new THREE.Vector3(4, 5, 6));
    assert.deepStrictEqual(group.getSize(), new THREE.Vector3(2, 2, 2));
    assert.deepEqual(events, []);
  });
});
