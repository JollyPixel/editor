// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { BlockTransform } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  createModelFixture,
  type ModelFixture
} from "../../fixtures/model.ts";
import {
  assertCloseTo,
  recordCommands,
  transformAt
} from "./blockHelpers.ts";

function rotatedParentWithChild(
  fixture: ModelFixture
) {
  const parent = fixture.addBlock({
    transform: BlockTransform.create({
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

describe("ModelBlocks transforms", () => {
  test("applyTransform moves a view without touching the document, and says so", () => {
    const fixture = createModelFixture();
    const block = fixture.addBlock();
    const commands = recordCommands(fixture.document);
    const applied: string[] = [];
    fixture.blocks.on("transformApplied", (uuid) => applied.push(uuid));

    fixture.blocks.applyTransform(block.uuid, transformAt({ x: 7, y: 0, z: 0 }));

    assert.equal(block.position.x, 7);
    assert.deepEqual(applied, [block.uuid]);
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
    fixture.document.move(child.uuid, parent.uuid, {
      transforms: [{ id: child.uuid, transform }]
    });
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
      transform: BlockTransform.create({
        pivotOffset: { x: 1, y: 0, z: 0 },
        scale: { x: 2, y: 2, z: 2 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: BlockTransform.create({
        position: { x: 1, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 0.5, z: 0 }
      })
    });
    fixture.scene.updateMatrixWorld(true);

    assertCloseTo(parent.worldPosition, [0, 0, 0]);
    assertCloseTo(parent.mesh.getWorldPosition(new THREE.Vector3()), [-2, 0, 0]);
    assertCloseTo(child.worldPosition, [2, 0, 0]);
    assertCloseTo(child.mesh.getWorldPosition(new THREE.Vector3()), [2, -1, 0]);
    assertCloseTo(child.mesh.getWorldScale(new THREE.Vector3()), [2, 2, 2]);
  });

  test("under keeps the world size of a block moved between differently scaled parents", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: BlockTransform.create({
        scale: { x: 2, y: 2, z: 2 }
      })
    });
    const child = fixture.addBlock({
      transform: BlockTransform.create({
        position: { x: 4, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 1, z: 0 }
      })
    });
    fixture.scene.updateMatrixWorld(true);
    const worldPivot = child.worldPosition;

    const transform = fixture.blocks.under(child.uuid, parent.uuid);
    fixture.document.move(child.uuid, parent.uuid, {
      transforms: [{ id: child.uuid, transform }]
    });
    fixture.scene.updateMatrixWorld(true);

    assert.deepEqual(transform.scale, { x: 0.5, y: 0.5, z: 0.5 });
    assertCloseTo(child.worldPosition, worldPivot.toArray());
    assertCloseTo(child.mesh.getWorldScale(new THREE.Vector3()), [1, 1, 1]);
  });

  test("a per-axis scale stretches children along that axis of the parent only", () => {
    const fixture = createModelFixture();
    const parent = fixture.addBlock({
      transform: BlockTransform.create({
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
      transform: BlockTransform.create({
        scale: { x: 3, y: 1, z: 1 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: BlockTransform.create({
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
      transform: BlockTransform.create({
        scale: { x: 3, y: 1, z: 1 }
      })
    });
    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: BlockTransform.create({
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
      transform: BlockTransform.create({
        position: { x: 5, y: 0, z: 0 },
        pivotOffset: { x: 1, y: 0, z: 0 }
      })
    });

    const child = fixture.addBlock({
      parentId: parent.uuid,
      transform: BlockTransform.create()
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
