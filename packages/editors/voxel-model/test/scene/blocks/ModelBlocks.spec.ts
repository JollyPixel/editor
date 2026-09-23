// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  createBlockTransform,
  type BlockTransformJSON,
  type ModelDocument,
  type VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  createModelFixture,
  type ModelFixture
} from "../../fixtures/model.ts";

function recordCommands(
  document: ModelDocument
): VoxelModelCommand[] {
  const commands: VoxelModelCommand[] = [];
  document.on("change", (change) => commands.push(change.command));

  return commands;
}

function transformAt(
  position: { x: number; y: number; z: number; }
): BlockTransformJSON {
  return createBlockTransform({ position });
}

function assertCloseTo(
  actual: THREE.Vector3,
  expected: [number, number, number]
): void {
  actual.toArray().forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) < 1e-6,
      `axis ${index}: ${value} is not ${expected[index]}`
    );
  });
}

function rotatedParentWithChild(
  fixture: ModelFixture
) {
  const parent = fixture.addBlock({
    transform: createBlockTransform({
      position: { x: 10, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 }
    })
  });
  const child = fixture.addBlock({
    transform: transformAt({ x: 1, y: 2, z: 3 })
  });
  fixture.scene.updateMatrixWorld(true);

  return { parent, child };
}

describe("ModelBlocks projection", () => {
  test("mirrors the blocks of the document it is built over", () => {
    const fixture = createModelFixture();
    const id = fixture.document.addBlock({
      name: "Torso",
      transform: transformAt({ x: 1, y: 2, z: 3 })
    });
    fixture.document.addFolder({ name: "Limbs" });

    const block = fixture.blocks.get(id!);

    assert.equal(fixture.blocks.size, 1);
    assert.equal(block?.name, "Torso");
    assert.deepEqual(block?.transform, transformAt({ x: 1, y: 2, z: 3 }));
    assert.equal(block?.root.parent, fixture.scene);
  });

  test("parents a block to the pivot of its nearest block, through folders", () => {
    const fixture = createModelFixture();
    const body = fixture.addBlock({ name: "Body" });
    const folderId = fixture.document.addFolder({
      name: "Limbs",
      parentId: body.uuid
    });
    const arm = fixture.addBlock({
      name: "Arm",
      parentId: folderId
    });

    assert.equal(arm.root.parent, body.pivot);
  });

  test("follows renames, transforms and removals of either origin", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock({ name: "Arm" });

    fixture.document.rename(block.uuid, "Leg");
    fixture.document.apply({
      action: "node-transformed",
      id: block.uuid,
      transform: transformAt({ x: 4, y: 0, z: 0 })
    });

    assert.equal(block.name, "Leg");
    assert.equal(block.position.x, 4);

    fixture.document.remove(block.uuid);

    assert.equal(fixture.blocks.get(block.uuid), undefined);
    assert.equal(block.root.parent, null);
  });

  test("drops the views of a whole removed subtree", () => {
    const fixture = createModelFixture();
    const folderId = fixture.document.addFolder({ name: "Limbs" });
    const arm = fixture.addBlock({ parentId: folderId });
    const hand = fixture.addBlock({ parentId: arm.uuid });

    fixture.document.remove(folderId!);

    assert.equal(fixture.blocks.size, 0);
    assert.equal(hand.root.parent, null);
  });

  test("re-parents the blocks a moved folder carries and applies their transforms", () => {
    const fixture = createModelFixture();
    const body = fixture.addBlock({ name: "Body" });
    const folderId = fixture.document.addFolder({ name: "Limbs" });
    const arm = fixture.addBlock({ parentId: folderId });

    fixture.document.move(folderId!, body.uuid, [
      { id: arm.uuid, transform: transformAt({ x: -2, y: 0, z: 0 }) }
    ]);

    assert.equal(arm.root.parent, body.pivot);
    assert.equal(arm.position.x, -2);
  });

  test("rebuilds every view on a reset, parenting nodes in any order", () => {
    const fixture = createModelFixture();
    const stale = fixture.addBlock();

    fixture.document.load({
      nodes: [
        {
          kind: "block",
          id: "child",
          parentId: "parent",
          name: "Child",
          transform: transformAt({ x: 1, y: 0, z: 0 })
        },
        {
          kind: "block",
          id: "parent",
          parentId: null,
          name: "Parent",
          transform: transformAt({ x: 0, y: 0, z: 0 })
        }
      ]
    });

    assert.equal(fixture.blocks.get(stale.uuid), undefined);
    assert.equal(fixture.blocks.size, 2);
    assert.equal(
      fixture.blocks.get("child")?.root.parent,
      fixture.blocks.get("parent")?.pivot
    );
  });

  test("stops following the document once disposed", () => {
    const fixture = createModelFixture();
    fixture.blocks.dispose();

    fixture.document.addBlock({ name: "Late" });

    assert.equal(fixture.blocks.size, 0);
  });
});

describe("ModelBlocks transforms", () => {
  test("applyTransform moves a view without touching the document", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    const commands = recordCommands(fixture.document);

    fixture.blocks.applyTransform(block.uuid, transformAt({ x: 7, y: 0, z: 0 }));

    assert.equal(block.position.x, 7);
    assert.deepEqual(commands, []);
    assert.equal(
      fixture.document.tree.block(block.uuid)?.transform.position.x,
      0
    );
  });

  test("commitTransform writes the view's transform to the document", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    const commands = recordCommands(fixture.document);

    block.position = new THREE.Vector3(3, 0, 0);
    fixture.blocks.commitTransform(block.uuid);
    fixture.blocks.commitTransform("missing");

    assert.deepEqual(commands, [
      {
        action: "node-transformed",
        id: block.uuid,
        transform: transformAt({ x: 3, y: 0, z: 0 })
      }
    ]);
  });
});

describe("ModelBlocks poses", () => {
  test("under keeps the world pose of a block placed under a rotated parent", () => {
    const fixture = createModelFixture();
    const { parent, child } = rotatedParentWithChild(fixture);
    const worldPosition = child.worldPosition;
    const worldRotation = child.pivot.getWorldQuaternion(new THREE.Quaternion());

    const transform = fixture.blocks.under(child.uuid, parent.uuid);
    fixture.document.move(child.uuid, parent.uuid, [
      { id: child.uuid, transform }
    ]);
    fixture.scene.updateMatrixWorld(true);

    assert.equal(child.root.parent, parent.pivot);
    assertCloseTo(child.worldPosition, worldPosition.toArray());
    assert.ok(
      child.pivot
        .getWorldQuaternion(new THREE.Quaternion())
        .angleTo(worldRotation) < 1e-6
    );
  });

  test("under the scene restores the world pose as the local one", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: transformAt({ x: 10, y: 0, z: 0 })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: transformAt({ x: 1, y: 0, z: 0 })
    });

    assert.deepEqual(
      fixture.blocks.under(child.uuid, null).position,
      { x: 11, y: 0, z: 0 }
    );
  });

  test("originUnder puts a new child on its parent's position", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        position: { x: 5, y: 0, z: 0 },
        pivotOffset: { x: 1, y: 0, z: 0 }
      })
    });

    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: createBlockTransform({
        position: fixture.blocks.originUnder(parent.uuid)
      })
    });
    fixture.scene.updateMatrixWorld(true);

    assertCloseTo(child.worldPosition, [5, 0, 0]);
  });

  test("mirror flips each block from its own world pose and reports the result", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: transformAt({ x: 2, y: 0, z: 0 })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: transformAt({ x: 1, y: 3, z: 0 })
    });
    const commands = recordCommands(fixture.document);

    const mirrored = fixture.blocks.mirror(
      [parent.uuid, child.uuid, "missing"],
      { x: true, y: false, z: false }
    );
    fixture.scene.updateMatrixWorld(true);

    assertCloseTo(parent.worldPosition, [-2, 0, 0]);
    assertCloseTo(child.worldPosition, [-3, 3, 0]);
    assert.deepEqual(
      mirrored,
      [
        { id: parent.uuid, transform: parent.transform },
        { id: child.uuid, transform: child.transform }
      ]
    );
    assert.deepEqual(commands, []);
  });
});

describe("ModelBlocks selection", () => {
  test("select updates the selected getter and emits the selected block", () => {
    const fixture = createModelFixture();
    const first = fixture.addBlock();
    const second = fixture.addBlock();
    const selections: unknown[] = [];
    fixture.blocks.on("select", (block) => selections.push(block));

    fixture.blocks.select(first);
    fixture.blocks.select(second);

    assert.equal(fixture.blocks.selected, second);
    assert.deepEqual(selections, [first, second]);
  });

  test("select emits even when the selection is unchanged", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    let emitted = 0;
    fixture.blocks.on("select", () => emitted++);

    fixture.blocks.select(block);
    fixture.blocks.select(block);

    assert.equal(emitted, 2);
  });

  test("removing the selected block clears the selection", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    fixture.blocks.select(block);

    fixture.document.remove(block.uuid);

    assert.equal(fixture.blocks.selected, null);
  });

  test("fromMesh resolves a block from its mesh only", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();

    assert.equal(fixture.blocks.fromMesh(block.mesh), block);
    assert.equal(fixture.blocks.fromMesh(block.pivot), undefined);
  });
});

describe("ModelBlocks hover", () => {
  test("hover updates the hovered getter and emits the hovered block", () => {
    const fixture = createModelFixture();
    const first = fixture.addBlock();
    const second = fixture.addBlock();
    const hovers: unknown[] = [];
    fixture.blocks.on("hover", (block) => hovers.push(block));

    fixture.blocks.hover(first);
    fixture.blocks.hover(second);
    fixture.blocks.hover(null);

    assert.equal(fixture.blocks.hovered, null);
    assert.deepEqual(hovers, [first, second, null]);
  });

  test("hovering the same block again does not re-emit", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    let emitted = 0;
    fixture.blocks.on("hover", () => emitted++);

    fixture.blocks.hover(block);
    fixture.blocks.hover(block);

    assert.equal(emitted, 1);
  });

  test("removing the hovered block clears the hover", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    fixture.blocks.hover(block);

    fixture.document.remove(block.uuid);

    assert.equal(fixture.blocks.hovered, null);
  });
});

describe("ModelBlocks textures", () => {
  test("applies the shared texture to existing and future blocks", () => {
    const fixture = createModelFixture();
    const existing = fixture.addBlock();
    const texture = new THREE.Texture();

    fixture.blocks.texture = texture;
    const future = fixture.addBlock();

    assert.equal(existing.texture, texture);
    assert.equal(future.texture, texture);
  });
});
