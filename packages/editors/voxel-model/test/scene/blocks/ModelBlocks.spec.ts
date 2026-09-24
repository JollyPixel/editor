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
    assert.equal(block?.node.parent, fixture.scene);
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

    assert.equal(arm.node.parent, body.node);
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
    assert.equal(block.node.parent, null);
  });

  test("drops the views of a whole removed subtree", () => {
    const fixture = createModelFixture();
    const folderId = fixture.document.addFolder({ name: "Limbs" });
    const arm = fixture.addBlock({ parentId: folderId });
    const hand = fixture.addBlock({ parentId: arm.uuid });

    fixture.document.remove(folderId!);

    assert.equal(fixture.blocks.size, 0);
    assert.equal(hand.node.parent, null);
  });

  test("re-parents the blocks a moved folder carries and applies their transforms", () => {
    const fixture = createModelFixture();
    const body = fixture.addBlock({ name: "Body" });
    const folderId = fixture.document.addFolder({ name: "Limbs" });
    const arm = fixture.addBlock({ parentId: folderId });

    fixture.document.move(folderId!, body.uuid, [
      { id: arm.uuid, transform: transformAt({ x: -2, y: 0, z: 0 }) }
    ]);

    assert.equal(arm.node.parent, body.node);
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
      fixture.blocks.get("child")?.node.parent,
      fixture.blocks.get("parent")?.node
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
    const worldRotation = child.node.getWorldQuaternion(new THREE.Quaternion());

    const transform = fixture.blocks.under(child.uuid, parent.uuid);
    fixture.document.move(child.uuid, parent.uuid, [
      { id: child.uuid, transform }
    ]);
    fixture.scene.updateMatrixWorld(true);

    assert.equal(child.node.parent, parent.node);
    assertCloseTo(child.worldPosition, worldPosition.toArray());
    assert.ok(
      child.node
        .getWorldQuaternion(new THREE.Quaternion())
        .angleTo(worldRotation) < 1e-6
    );
  });

  test("a block's scale carries its children around its pivot", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        pivotOffset: { x: 1, y: 0, z: 0 },
        scale: { x: 2, y: 2, z: 2 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: createBlockTransform({
        position: { x: 1, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 0.5, z: 0 }
      })
    });
    fixture.scene.updateMatrixWorld(true);

    assertCloseTo(parent.worldPosition, [0, 0, 0]);
    assertCloseTo(parent.mesh.getWorldPosition(new THREE.Vector3()), [-2, 0, 0]);
    assertCloseTo(child.worldPosition, [2, 0, 0]);
    assertCloseTo(child.worldPosition, [2, 0, 0]);
    assertCloseTo(child.mesh.getWorldPosition(new THREE.Vector3()), [2, -1, 0]);
    assertCloseTo(child.mesh.getWorldScale(new THREE.Vector3()), [2, 2, 2]);
  });

  test("under keeps the world size of a block moved between differently scaled parents", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        scale: { x: 2, y: 2, z: 2 }
      })
    });
    const child = fixture.addBlock({
      transform: createBlockTransform({
        position: { x: 4, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 1, z: 0 }
      })
    });
    fixture.scene.updateMatrixWorld(true);
    const worldPivot = child.worldPosition;

    const transform = fixture.blocks.under(child.uuid, parent.uuid);
    fixture.document.move(child.uuid, parent.uuid, [
      { id: child.uuid, transform }
    ]);
    fixture.scene.updateMatrixWorld(true);

    assert.deepEqual(transform.scale, { x: 0.5, y: 0.5, z: 0.5 });
    assertCloseTo(child.worldPosition, [4, 0, 0]);
    assertCloseTo(child.worldPosition, worldPivot.toArray());
    assertCloseTo(child.mesh.getWorldScale(new THREE.Vector3()), [1, 1, 1]);
  });

  test("a per-axis scale stretches children along that axis of the parent only", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        scale: { x: 3, y: 1, z: 1 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: transformAt({ x: 1, y: 1, z: 1 })
    });
    fixture.scene.updateMatrixWorld(true);

    assertCloseTo(child.worldPosition, [3, 1, 1]);
    assertCloseTo(child.mesh.getWorldScale(new THREE.Vector3()), [3, 1, 1]);
  });

  test("a child takes its parent's scale on the same axis whatever its rotation", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        scale: { x: 3, y: 1, z: 1 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: createBlockTransform({
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 }
      })
    });
    fixture.scene.updateMatrixWorld(true);

    assertCloseTo(child.worldPosition, [3, 0, 0]);
    assertCloseTo(child.mesh.getWorldScale(new THREE.Vector3()), [3, 1, 1]);
  });

  test("an angled child stays a box under a stretched parent", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        scale: { x: 3, y: 1, z: 1 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: createBlockTransform({
        pivotOffset: { x: 0.5, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 6, z: 0 }
      })
    });
    fixture.scene.updateMatrixWorld(true);

    const x = new THREE.Vector3();
    const y = new THREE.Vector3();
    const z = new THREE.Vector3();
    child.mesh.matrixWorld.extractBasis(x, y, z);
    const scale = child.mesh.getWorldScale(new THREE.Vector3());

    assert.ok(Math.abs(x.dot(y)) < 1e-6 && Math.abs(x.dot(z)) < 1e-6 && Math.abs(y.dot(z)) < 1e-6);
    assertCloseTo(scale, [3, 1, 1]);
    assertCloseTo(child.worldPosition, [0, 0, 0]);
    assertCloseTo(
      child.mesh.getWorldPosition(new THREE.Vector3()),
      [-1.5 * Math.cos(Math.PI / 6), 0, 1.5 * Math.sin(Math.PI / 6)]
    );
    assert.deepEqual(child.transform.scale, { x: 1, y: 1, z: 1 });
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

  test("a new child with the default transform sits on its parent's pivot", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: createBlockTransform({
        position: { x: 5, y: 0, z: 0 },
        pivotOffset: { x: 1, y: 0, z: 0 }
      })
    });

    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: createBlockTransform()
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
  test("removing the selected and hovered block clears both marks", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    fixture.selection.select(block.uuid);
    fixture.selection.hover(block.uuid);

    fixture.document.remove(block.uuid);

    assert.equal(fixture.selection.selected, null);
    assert.equal(fixture.selection.hovered, null);
  });

  test("fromMesh resolves a block from its mesh only", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();

    assert.equal(fixture.blocks.fromMesh(block.mesh), block);
    assert.equal(fixture.blocks.fromMesh(block.node), undefined);
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
