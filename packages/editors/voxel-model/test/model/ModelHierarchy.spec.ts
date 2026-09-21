// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  createBlockTransform,
  type VoxelModelCommand
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  ModelHierarchy,
  type BlockRegions,
  type HierarchyNode
} from "#src/model/index.ts";
import {
  createModelFixture,
  type ModelFixture
} from "../fixtures/model.ts";

// CONSTANTS
const kNoMirror = { x: false, y: false, z: false };

interface Harness extends ModelFixture {
  hierarchy: ModelHierarchy;
  regions: string[];
  commands: VoxelModelCommand[];
}

function createHarness(): Harness {
  const fixture = createModelFixture();
  const regions: string[] = [];
  const regionPort: BlockRegions = {
    create: (uuid, name) => regions.push(`create:${name}:${uuid}`),
    copy: (sourceUuid, uuid, name) => regions.push(`copy:${name}:${sourceUuid}->${uuid}`)
  };
  const commands: VoxelModelCommand[] = [];
  fixture.document.on("change", (change) => commands.push(change.command));

  return {
    ...fixture,
    hierarchy: new ModelHierarchy({
      document: fixture.document,
      regions: regionPort,
      poses: fixture.blocks
    }),
    regions,
    commands
  };
}

function shapeOf(
  nodes: readonly HierarchyNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children.length > 0 ? [node.name, shapeOf(node.children)] : node.name
  ));
}

function at(
  x: number,
  y = 0,
  z = 0
) {
  return createBlockTransform({
    position: { x, y, z }
  });
}

describe("ModelHierarchy.nodes", () => {
  test("lists folders first, then blocks under their folder or block parent", () => {
    const { document, addBlock, hierarchy } = createHarness();
    addBlock({ name: "Body" });
    const folderId = document.addFolder({ name: "Arms" });
    const arm = addBlock({ name: "Arm", parentId: folderId });
    addBlock({ name: "Hand", parentId: arm.uuid });

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Arms", [["Arm", ["Hand"]]]],
      "Body"
    ]);
    assert.equal(hierarchy.nodes()[0].kind, "folder");
  });

  test("nests folders under folders, and a folder under a block beside its children", () => {
    const { addBlock, hierarchy } = createHarness();
    const body = addBlock({ name: "Body" });
    addBlock({ name: "Head", parentId: body.uuid });
    const outer = hierarchy.createFolder("Outer", body.uuid);
    hierarchy.createFolder("Inner", outer);

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Body", [["Outer", ["Inner"]], "Head"]]
    ]);
  });

  test("labels unnamed nodes by kind", () => {
    const { document, hierarchy } = createHarness();
    document.addFolder({ name: "" });
    document.addBlock({ name: "" });

    assert.deepEqual(shapeOf(hierarchy.nodes()), ["Folder", "Block"]);
  });
});

describe("ModelHierarchy.createBlock", () => {
  test("creates the block with one command and gives it its UV region", () => {
    const { hierarchy, regions, commands } = createHarness();

    const uuid = hierarchy.createBlock("Head", null);

    assert.ok(uuid);
    assert.deepEqual(regions, [`create:Head:${uuid}`]);
    assert.deepEqual(commands.map((command) => command.action), ["node-added"]);
  });

  test("under a block, lands on the parent's position as its child", () => {
    const { document, blocks, addBlock, hierarchy } = createHarness();
    const parent = addBlock({ transform: at(4) });

    const uuid = hierarchy.createBlock("Child", parent.uuid);

    assert.ok(uuid);
    assert.equal(document.tree.transformParentOf(uuid), parent.uuid);
    assert.deepStrictEqual(
      blocks.get(uuid)?.worldPosition,
      new THREE.Vector3(4, 0, 0)
    );
  });

  test("under a folder, sits in it and inherits from the folder's nearest block", () => {
    const { document, blocks, addBlock, hierarchy } = createHarness();
    const parent = addBlock();
    const folderId = hierarchy.createFolder("Folder", parent.uuid);

    const uuid = hierarchy.createBlock("Child", folderId);

    assert.ok(uuid);
    assert.equal(document.tree.get(uuid)?.parentId, folderId);
    assert.equal(blocks.get(uuid)?.root.parent, parent.pivot);
  });

  test("returns null and creates no region under an unknown parent", () => {
    const { hierarchy, regions } = createHarness();

    assert.equal(hierarchy.createBlock("Child", "missing"), null);
    assert.deepEqual(regions, []);
  });
});

describe("ModelHierarchy.move", () => {
  test("moves a block in and out of a folder as one command each", () => {
    const { document, addBlock, hierarchy, commands } = createHarness();
    const parent = addBlock();
    const folderId = hierarchy.createFolder("Folder", parent.uuid);
    const block = addBlock();
    commands.length = 0;

    hierarchy.move(block.uuid, folderId);

    assert.equal(document.tree.get(block.uuid)?.parentId, folderId);
    assert.equal(document.tree.transformParentOf(block.uuid), parent.uuid);

    hierarchy.move(block.uuid, null);

    assert.equal(document.tree.get(block.uuid)?.parentId, null);
    assert.equal(document.tree.transformParentOf(block.uuid), null);
    assert.deepEqual(
      commands.map((command) => command.action),
      ["node-moved", "node-moved"]
    );
  });

  test("keeps the world position of a block moved under another block", () => {
    const { blocks, scene, addBlock, hierarchy } = createHarness();
    const anchor = addBlock({ transform: at(10) });
    const block = addBlock({ transform: at(3, 2) });

    hierarchy.move(block.uuid, anchor.uuid);
    scene.updateMatrixWorld(true);

    assert.equal(block.root.parent, anchor.pivot);
    assert.deepStrictEqual(
      blocks.get(block.uuid)?.worldPosition,
      new THREE.Vector3(3, 2, 0)
    );
    assert.deepEqual(block.transform.position, { x: -7, y: 2, z: 0 });
  });

  test("moving a folder carries the blocks of its subtree in the same command", () => {
    const { document, scene, addBlock, hierarchy, commands } = createHarness();
    const anchor = addBlock({ transform: at(10) });
    const outer = hierarchy.createFolder("Outer", null);
    const inner = hierarchy.createFolder("Inner", outer);
    const block = addBlock({ parentId: inner, transform: at(1) });
    const nested = addBlock({ parentId: block.uuid });
    commands.length = 0;

    hierarchy.move(outer!, anchor.uuid);
    scene.updateMatrixWorld(true);

    assert.equal(document.tree.transformParentOf(block.uuid), anchor.uuid);
    assert.equal(document.tree.get(block.uuid)?.parentId, inner);
    assert.deepStrictEqual(block.worldPosition, new THREE.Vector3(1, 0, 0));
    assert.equal(commands.length, 1);
    assert.partialDeepStrictEqual(commands[0], {
      action: "node-moved",
      id: outer,
      parentId: anchor.uuid,
      transforms: [{ id: block.uuid }]
    });
    assert.equal(nested.root.parent, block.pivot);
  });

  test("rewrites no transform when the transform parent is unchanged", () => {
    const { addBlock, hierarchy, commands } = createHarness();
    const folderId = hierarchy.createFolder("Folder", null);
    const block = addBlock();
    commands.length = 0;

    hierarchy.move(block.uuid, folderId);

    assert.partialDeepStrictEqual(commands[0], { transforms: [] });
  });

  test("refuses to move a node into its own subtree", () => {
    const { document, hierarchy } = createHarness();
    const outer = hierarchy.createFolder("Outer", null);
    const inner = hierarchy.createFolder("Inner", outer);

    hierarchy.move(outer!, inner);

    assert.equal(document.tree.get(outer!)?.parentId, null);
  });
});

describe("ModelHierarchy.rename", () => {
  test("renames blocks and folders alike", () => {
    const { document, addBlock, hierarchy } = createHarness();
    const block = addBlock({ name: "Block" });
    const folderId = hierarchy.createFolder("Folder", null);

    hierarchy.rename(block.uuid, "Torso");
    hierarchy.rename(folderId!, "Limbs");

    assert.equal(block.name, "Torso");
    assert.equal(document.tree.get(folderId!)?.name, "Limbs");
  });
});

describe("ModelHierarchy.duplicate", () => {
  test("copies a block next to its source with a Copy suffix and a copied region", () => {
    const { blocks, addBlock, hierarchy, regions } = createHarness();
    const source = addBlock({ name: "Arm", transform: at(1, 2, 3) });

    const duplicateId = hierarchy.duplicate(source.uuid, {
      includeChildren: false,
      mirrorAxes: kNoMirror
    });

    assert.ok(duplicateId);
    assert.equal(blocks.get(duplicateId)?.name, "Arm Copy");
    assert.deepEqual(blocks.get(duplicateId)?.transform, source.transform);
    assert.deepEqual(regions, [`copy:Arm Copy:${source.uuid}->${duplicateId}`]);
  });

  test("copies a folder subtree, keeping child names", () => {
    const { addBlock, hierarchy } = createHarness();
    const folderId = hierarchy.createFolder("Limbs", null);
    addBlock({ name: "Arm", parentId: folderId });

    const duplicateId = hierarchy.duplicate(folderId!, {
      includeChildren: true,
      mirrorAxes: kNoMirror
    });

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Limbs", ["Arm"]],
      ["Limbs Copy", ["Arm"]]
    ]);
    assert.ok(duplicateId && hierarchy.isFolder(duplicateId));
  });

  test("leaves the children behind unless asked for them", () => {
    const { addBlock, hierarchy } = createHarness();
    const body = addBlock({ name: "Body" });
    addBlock({ name: "Head", parentId: body.uuid });

    hierarchy.duplicate(body.uuid, {
      includeChildren: false,
      mirrorAxes: kNoMirror
    });

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Body", ["Head"]],
      "Body Copy"
    ]);
  });

  test("mirrors every duplicated block when an axis is requested", () => {
    const { document, blocks, addBlock, hierarchy } = createHarness();
    const source = addBlock({ transform: at(2) });
    const mirrorAxes = { x: true, y: false, z: false };

    const duplicateId = hierarchy.duplicate(source.uuid, {
      includeChildren: false,
      mirrorAxes
    });

    assert.ok(duplicateId !== null);
    assert.deepStrictEqual(
      blocks.get(duplicateId)?.worldPosition,
      new THREE.Vector3(-2, 0, 0)
    );
    assert.deepEqual(document.tree.block(duplicateId)?.flipAxes, mirrorAxes);
    assert.deepEqual(
      document.tree.block(duplicateId)?.transform.position,
      { x: -2, y: 0, z: 0 }
    );
  });

  test("returns null for an unknown source", () => {
    const { hierarchy } = createHarness();

    assert.equal(hierarchy.duplicate("missing", { includeChildren: true, mirrorAxes: kNoMirror }), null);
  });
});

describe("ModelHierarchy.remove", () => {
  test("with children, removes the whole subtree as one command", () => {
    const { blocks, addBlock, hierarchy, commands } = createHarness();
    const folderId = hierarchy.createFolder("Limbs", null);
    addBlock({ name: "Arm", parentId: folderId });
    commands.length = 0;

    hierarchy.remove(folderId!, { withChildren: true });

    assert.deepEqual(hierarchy.nodes(), []);
    assert.equal(blocks.size, 0);
    assert.deepEqual(commands, [{ action: "node-removed", id: folderId }]);
  });

  test("without children, promotes them to the removed node's parent in place", () => {
    const { document, blocks, scene, addBlock, hierarchy } = createHarness();
    const root = addBlock({ name: "Root", transform: at(1) });
    const middle = addBlock({ name: "Middle", parentId: root.uuid, transform: at(2) });
    const leaf = addBlock({ name: "Leaf", parentId: middle.uuid, transform: at(4) });

    hierarchy.remove(middle.uuid, { withChildren: false });
    scene.updateMatrixWorld(true);

    assert.equal(blocks.get(middle.uuid), undefined);
    assert.equal(document.tree.transformParentOf(leaf.uuid), root.uuid);
    assert.deepStrictEqual(leaf.worldPosition, new THREE.Vector3(7, 0, 0));
  });

  test("without children, promotes the blocks a child folder carries", () => {
    const { document, addBlock, hierarchy } = createHarness();
    const body = addBlock({ name: "Body" });
    const folderId = hierarchy.createFolder("Limbs", body.uuid);
    const arm = addBlock({ name: "Arm", parentId: folderId });

    hierarchy.remove(body.uuid, { withChildren: false });

    assert.deepEqual(shapeOf(hierarchy.nodes()), [["Limbs", ["Arm"]]]);
    assert.equal(document.tree.transformParentOf(arm.uuid), null);
    assert.equal(arm.root.parent?.type, "Scene");
  });

  test("without children, removing a folder keeps its blocks at the folder's parent", () => {
    const { addBlock, hierarchy } = createHarness();
    const folderId = hierarchy.createFolder("Limbs", null);
    addBlock({ name: "Arm", parentId: folderId });

    hierarchy.remove(folderId!, { withChildren: false });

    assert.deepEqual(shapeOf(hierarchy.nodes()), ["Arm"]);
  });
});
