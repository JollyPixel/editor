// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type {
  GroupTransformJSON,
  ModelCommand
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  ModelBlocks,
  type ModelBlock
} from "#src/model/index.ts";

// CONSTANTS
const kIdentityTransform: GroupTransformJSON = {
  position: { x: 0, y: 0, z: 0 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

function createBlocks(): ModelBlocks {
  return new ModelBlocks(new THREE.Scene());
}

function recordCommands(
  blocks: ModelBlocks
): ModelCommand[] {
  const commands: ModelCommand[] = [];
  blocks.on("command", (command) => commands.push(command));

  return commands;
}

function transformAt(
  position: { x: number; y: number; z: number; }
): GroupTransformJSON {
  return { ...kIdentityTransform, position };
}

describe("ModelBlocks.duplicate", () => {
  test("returns null when the source uuid does not exist", () => {
    assert.equal(createBlocks().duplicate("missing"), null);
  });

  test("clones transform, size and scale from the source into a new block", () => {
    const blocks = createBlocks();
    const source = blocks.add({
      position: new THREE.Vector3(1, 2, 3),
      pivotOffset: new THREE.Vector3(0.5, 0, 0),
      size: new THREE.Vector3(2, 3, 4),
      scale: new THREE.Vector3(1, 2, 1),
      name: "Torso"
    });
    source.rotation = new THREE.Euler(0, Math.PI / 4, 0);

    const duplicate = blocks.duplicate(source.uuid);

    assert.ok(duplicate);
    assert.notEqual(duplicate.uuid, source.uuid);
    assert.equal(duplicate.name, "Torso");
    assert.deepEqual(duplicate.transform, source.transform);
  });

  test("uses the provided name instead of the source's name", () => {
    const blocks = createBlocks();
    const source = blocks.add({ name: "Torso" });

    assert.equal(blocks.duplicate(source.uuid, "Torso Copy")?.name, "Torso Copy");
  });
});

describe("ModelBlocks.mirror", () => {
  test("does nothing for uuids that don't exist", () => {
    assert.doesNotThrow(() => {
      createBlocks().mirror(["missing"], { x: true, y: false, z: false });
    });
  });

  test("mirrors a block's world position along every requested axis", () => {
    const blocks = createBlocks();
    const single = blocks.add({ position: new THREE.Vector3(2, 3, 4) });
    const all = blocks.add({ position: new THREE.Vector3(2, 3, 4) });

    blocks.mirror([single.uuid], { x: true, y: false, z: false });
    blocks.mirror([all.uuid], { x: true, y: true, z: true });

    assert.deepStrictEqual(single.worldPosition, new THREE.Vector3(-2, 3, 4));
    assert.deepStrictEqual(all.worldPosition, new THREE.Vector3(-2, -3, -4));
  });

  test("mirrors each block from its own world transform, not a mirrored parent's", () => {
    const blocks = createBlocks();
    const parent = blocks.add({ position: new THREE.Vector3(2, 0, 0) });
    const child = blocks.add({ position: new THREE.Vector3(1, 0, 0) });
    blocks.reparentLocal(child.uuid, parent.uuid);

    blocks.mirror([parent.uuid, child.uuid], { x: true, y: false, z: false });

    assert.deepStrictEqual(parent.worldPosition, new THREE.Vector3(-2, 0, 0));
    assert.deepStrictEqual(child.worldPosition, new THREE.Vector3(-3, 0, 0));
  });

  test("emits one group-transformed command carrying flipAxes per mirrored block", () => {
    const blocks = createBlocks();
    const a = blocks.add({ position: new THREE.Vector3(1, 0, 0) });
    const b = blocks.add({ position: new THREE.Vector3(0, 1, 0) });
    const commands = recordCommands(blocks);

    blocks.mirror([a.uuid, b.uuid], { x: true, y: false, z: false });

    assert.deepEqual(
      commands.map((command) => (command.action === "group-transformed" ? command.flipAxes : command.action)),
      [
        { x: true, y: false, z: false },
        { x: true, y: false, z: false }
      ]
    );
    assert.deepEqual(blocks.flipAxesOf(a.uuid), { x: true, y: false, z: false });
  });
});

describe("ModelBlocks reparenting", () => {
  test("reparentLocal keeps the child's local position, unlike reparent", () => {
    const blocks = createBlocks();
    const parent = blocks.add({ position: new THREE.Vector3(10, 0, 0) });
    const child = blocks.add({ position: new THREE.Vector3(1, 1, 1) });

    blocks.reparentLocal(child.uuid, parent.uuid);

    assert.deepStrictEqual(child.position, new THREE.Vector3(1, 1, 1));
    assert.deepStrictEqual(child.worldPosition, new THREE.Vector3(11, 1, 1));
    assert.equal(blocks.parentOf(child.uuid), parent.uuid);

    blocks.reparentLocal(child.uuid, null);

    assert.deepStrictEqual(child.position, new THREE.Vector3(1, 1, 1));
    assert.equal(blocks.parentOf(child.uuid), null);
  });

  test("reparentAtParentPosition moves the child onto the parent first", () => {
    const blocks = createBlocks();
    const parent = blocks.add({ position: new THREE.Vector3(10, 5, -2) });
    const child = blocks.add();

    blocks.reparentAtParentPosition(child.uuid, parent.uuid);

    assert.deepStrictEqual(child.worldPosition, new THREE.Vector3(10, 5, -2));
    assert.deepStrictEqual(child.position, new THREE.Vector3(0, 0, 0));
  });

  test("reparentAtParentPosition ignores an unknown parent", () => {
    const blocks = createBlocks();
    const child = blocks.add({ position: new THREE.Vector3(1, 1, 1) });

    blocks.reparentAtParentPosition(child.uuid, "missing");

    assert.deepStrictEqual(child.worldPosition, new THREE.Vector3(1, 1, 1));
  });
});

describe("ModelBlocks commands", () => {
  test("add emits group-added with the block's uuid, name and transform", () => {
    const blocks = createBlocks();
    const commands = recordCommands(blocks);

    const block = blocks.add({ name: "Torso", position: new THREE.Vector3(1, 2, 3) });

    assert.deepEqual(commands, [{
      action: "group-added",
      uuid: block.uuid,
      name: "Torso",
      transform: transformAt({ x: 1, y: 2, z: 3 })
    }]);
  });

  test("remove, rename and reparentLocal emit their commands", () => {
    const blocks = createBlocks();
    const parent = blocks.add();
    const child = blocks.add({ name: "Block" });
    const commands = recordCommands(blocks);

    blocks.rename(child.uuid, "Torso");
    blocks.reparentLocal(child.uuid, parent.uuid);
    blocks.remove(parent.uuid);

    assert.equal(child.name, "Torso");
    assert.deepEqual(commands, [
      { action: "group-renamed", uuid: child.uuid, name: "Torso" },
      { action: "group-reparented-local", uuid: child.uuid, parentUuid: parent.uuid },
      { action: "group-removed", uuid: parent.uuid }
    ]);
  });

  test("reparent emits the resulting local transform", () => {
    const blocks = createBlocks();
    const parent = blocks.add({ position: new THREE.Vector3(10, 0, 0) });
    const child = blocks.add({ position: new THREE.Vector3(1, 1, 1) });
    const commands = recordCommands(blocks);

    blocks.reparent(child.uuid, parent.uuid);

    assert.deepEqual(commands, [{
      action: "group-reparented",
      uuid: child.uuid,
      parentUuid: parent.uuid,
      transform: transformAt({ x: -9, y: 1, z: 1 })
    }]);
  });

  test("commitTransform emits the current transform, and ignores an unknown uuid", () => {
    const blocks = createBlocks();
    const block = blocks.add();
    block.position = new THREE.Vector3(5, 6, 7);
    const commands = recordCommands(blocks);

    blocks.commitTransform("missing");
    blocks.commitTransform(block.uuid);

    assert.deepEqual(commands, [{
      action: "group-transformed",
      uuid: block.uuid,
      transform: transformAt({ x: 5, y: 6, z: 7 })
    }]);
  });

  test("applyTransform moves a block without emitting", () => {
    const blocks = createBlocks();
    const block = blocks.add();
    const commands = recordCommands(blocks);

    blocks.applyTransform(block.uuid, transformAt({ x: 4, y: 5, z: 6 }));

    assert.deepStrictEqual(block.position, new THREE.Vector3(4, 5, 6));
    assert.deepEqual(commands, []);
  });
});

describe("ModelBlocks selection", () => {
  test("select toggles the block flags and emits the selected block", () => {
    const blocks = createBlocks();
    const first = blocks.add();
    const second = blocks.add();
    const selections: (ModelBlock | null)[] = [];
    blocks.on("select", (block) => selections.push(block));

    blocks.select(first);
    blocks.select(second);

    assert.equal(first.selected, false);
    assert.equal(second.selected, true);
    assert.equal(blocks.selected, second);
    assert.deepEqual(selections, [first, second]);
  });

  test("select emits even when the selection is unchanged", () => {
    const blocks = createBlocks();
    let count = 0;
    blocks.on("select", () => count++);

    blocks.select(null);
    blocks.select(null);

    assert.equal(count, 2);
  });

  test("removing the selected block clears the selection", () => {
    const blocks = createBlocks();
    const block = blocks.add();
    blocks.select(block);

    blocks.remove(block.uuid);

    assert.equal(blocks.selected, null);
  });

  test("fromMesh resolves a block from its mesh only", () => {
    const blocks = createBlocks();
    const block = blocks.add();

    assert.equal(blocks.fromMesh(block.mesh), block);
    assert.equal(blocks.fromMesh(block.pivot), undefined);
  });
});

describe("ModelBlocks textures", () => {
  test("applies the shared texture to existing and future blocks", () => {
    const blocks = createBlocks();
    const before = blocks.add();
    const texture = new THREE.Texture();

    blocks.texture = texture;
    const after = blocks.add();

    assert.equal(before.texture, texture);
    assert.equal(after.texture, texture);
  });
});

describe("ModelBlocks.apply", () => {
  test("group-added creates a block under the given uuid without emitting", () => {
    const blocks = createBlocks();
    const commands = recordCommands(blocks);

    blocks.apply({
      action: "group-added",
      uuid: "remote-uuid",
      name: "Torso",
      transform: transformAt({ x: 1, y: 2, z: 3 })
    });

    assert.equal(blocks.get("remote-uuid")?.name, "Torso");
    assert.deepStrictEqual(blocks.get("remote-uuid")?.position, new THREE.Vector3(1, 2, 3));
    assert.deepEqual(commands, []);
  });

  test("group-added is a no-op when the uuid already exists", () => {
    const blocks = createBlocks();
    const added = {
      action: "group-added",
      uuid: "remote-uuid",
      name: "Torso",
      transform: kIdentityTransform
    } as const;

    blocks.apply(added);
    blocks.apply({ ...added, name: "Duplicate" });

    assert.equal(blocks.size, 1);
    assert.equal(blocks.get("remote-uuid")?.name, "Torso");
  });

  test("group-removed and group-renamed act silently", () => {
    const blocks = createBlocks();
    const kept = blocks.add({ name: "Block" });
    const removed = blocks.add();
    const commands = recordCommands(blocks);

    blocks.apply({ action: "group-renamed", uuid: kept.uuid, name: "Torso" });
    blocks.apply({ action: "group-removed", uuid: removed.uuid });

    assert.equal(kept.name, "Torso");
    assert.equal(blocks.get(removed.uuid), undefined);
    assert.deepEqual(commands, []);
  });

  test("group-reparented moves the block and applies the given transform", () => {
    const blocks = createBlocks();
    const parent = blocks.add();
    const child = blocks.add({ position: new THREE.Vector3(1, 1, 1) });

    blocks.apply({
      action: "group-reparented",
      uuid: child.uuid,
      parentUuid: parent.uuid,
      transform: transformAt({ x: -9, y: 1, z: 1 })
    });

    assert.equal(blocks.parentOf(child.uuid), parent.uuid);
    assert.deepStrictEqual(child.position, new THREE.Vector3(-9, 1, 1));
  });

  test("group-transformed applies the transform and records flipAxes when given", () => {
    const blocks = createBlocks();
    const block = blocks.add();
    blocks.mirror([block.uuid], { x: true, y: false, z: false });

    blocks.apply({
      action: "group-transformed",
      uuid: block.uuid,
      transform: { ...kIdentityTransform, size: { x: 2, y: 2, z: 2 } }
    });

    assert.deepStrictEqual(block.size, new THREE.Vector3(2, 2, 2));
    assert.deepEqual(blocks.flipAxesOf(block.uuid), { x: true, y: false, z: false });

    blocks.apply({
      action: "group-transformed",
      uuid: block.uuid,
      transform: kIdentityTransform,
      flipAxes: { x: false, y: true, z: false }
    });

    assert.deepEqual(blocks.flipAxesOf(block.uuid), { x: false, y: true, z: false });
  });
});

describe("ModelBlocks.load", () => {
  test("replaces every block, parents them in any order, and restores flipAxes", () => {
    const blocks = createBlocks();
    const stale = blocks.add();
    const commands = recordCommands(blocks);

    blocks.load([
      {
        uuid: "child",
        name: "Child",
        parentUuid: "root",
        ...kIdentityTransform,
        flipAxes: { x: true, y: false, z: false }
      },
      {
        uuid: "root",
        name: "Root",
        parentUuid: null,
        ...kIdentityTransform
      }
    ]);

    assert.equal(blocks.get(stale.uuid), undefined);
    assert.equal(blocks.parentOf("child"), "root");
    assert.deepEqual(blocks.flipAxesOf("child"), { x: true, y: false, z: false });
    assert.deepEqual(commands, []);
  });
});
