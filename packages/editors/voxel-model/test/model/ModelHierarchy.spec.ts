// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ModelDocument,
  ModelHierarchy,
  type BlockRegions,
  type HierarchyNode
} from "#src/model/index.ts";

// CONSTANTS
const kNoMirror = { x: false, y: false, z: false };

interface Harness {
  document: ModelDocument;
  hierarchy: ModelHierarchy;
  regions: string[];
}

function createHarness(): Harness {
  const document = new ModelDocument(new THREE.Scene());
  const regions: string[] = [];
  const regionPort: BlockRegions = {
    create: (uuid, name) => regions.push(`create:${name}:${uuid}`),
    copy: (sourceUuid, uuid, name) => regions.push(`copy:${name}:${sourceUuid}->${uuid}`)
  };

  return {
    document,
    hierarchy: new ModelHierarchy({ document, regions: regionPort }),
    regions
  };
}

function shapeOf(
  nodes: readonly HierarchyNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children.length > 0 ? [node.name, shapeOf(node.children)] : node.name
  ));
}

describe("ModelHierarchy.nodes", () => {
  test("lists folders first, then blocks under their folder or block parent", () => {
    const { document, hierarchy } = createHarness();
    const folderId = document.folders.add({ name: "Arms" });
    document.blocks.add({ name: "Body" });
    const arm = document.blocks.add({ name: "Arm" });
    const hand = document.blocks.add({ name: "Hand" });
    document.folders.place(arm.uuid, folderId);
    document.blocks.reparentLocal(hand.uuid, arm.uuid);

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Arms", [["Arm", ["Hand"]]]],
      "Body"
    ]);
    assert.equal(hierarchy.nodes()[0].kind, "folder");
  });

  test("nests folders under folders, and a folder under a block beside its children", () => {
    const { document, hierarchy } = createHarness();
    const body = document.blocks.add({ name: "Body" });
    const head = document.blocks.add({ name: "Head" });
    document.blocks.reparentLocal(head.uuid, body.uuid);
    const outer = hierarchy.createFolder("Outer", body.uuid);
    hierarchy.createFolder("Inner", outer);

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Body", [["Outer", ["Inner"]], "Head"]]
    ]);
  });

  test("labels unnamed nodes by kind", () => {
    const { document, hierarchy } = createHarness();
    document.folders.add({ name: "" });
    document.blocks.add();

    assert.deepEqual(shapeOf(hierarchy.nodes()), ["Folder", "Block"]);
  });
});

describe("ModelHierarchy.createBlock", () => {
  test("creates, selects and gives the block its UV region", () => {
    const { document, hierarchy, regions } = createHarness();

    const block = hierarchy.createBlock("Head", null);

    assert.equal(document.blocks.selected, block);
    assert.deepEqual(regions, [`create:Head:${block.uuid}`]);
  });

  test("under a block, lands on the parent's position as its child", () => {
    const { document, hierarchy } = createHarness();
    const parent = document.blocks.add({ position: new THREE.Vector3(4, 0, 0) });

    const child = hierarchy.createBlock("Child", parent.uuid);

    assert.equal(document.blocks.parentOf(child.uuid), parent.uuid);
    assert.deepStrictEqual(child.worldPosition, new THREE.Vector3(4, 0, 0));
  });

  test("under a folder, is placed in it and parented to the folder's nearest block", () => {
    const { document, hierarchy } = createHarness();
    const parent = document.blocks.add();
    const folderId = hierarchy.createFolder("Folder", parent.uuid);

    const child = hierarchy.createBlock("Child", folderId);

    assert.equal(document.folders.placements.get(child.uuid), folderId);
    assert.equal(document.blocks.parentOf(child.uuid), parent.uuid);
  });
});

describe("ModelHierarchy.move", () => {
  test("moving a block into a folder places it and reparents to the folder's block", () => {
    const { document, hierarchy } = createHarness();
    const parent = document.blocks.add();
    const folderId = hierarchy.createFolder("Folder", parent.uuid);
    const block = document.blocks.add();

    hierarchy.move(block.uuid, folderId);

    assert.equal(document.folders.placements.get(block.uuid), folderId);
    assert.equal(document.blocks.parentOf(block.uuid), parent.uuid);

    hierarchy.move(block.uuid, null);

    assert.equal(document.folders.placements.has(block.uuid), false);
    assert.equal(document.blocks.parentOf(block.uuid), null);
  });

  test("moving a folder reparents the blocks placed in its subtree", () => {
    const { document, hierarchy } = createHarness();
    const anchor = document.blocks.add();
    const outer = hierarchy.createFolder("Outer", null);
    const inner = hierarchy.createFolder("Inner", outer);
    const block = document.blocks.add();
    hierarchy.move(block.uuid, inner);

    hierarchy.move(outer, anchor.uuid);

    assert.equal(document.blocks.parentOf(block.uuid), anchor.uuid);
    assert.equal(document.folders.placements.get(block.uuid), inner);
  });
});

describe("ModelHierarchy.rename", () => {
  test("renames blocks and folders alike", () => {
    const { document, hierarchy } = createHarness();
    const block = document.blocks.add({ name: "Block" });
    const folderId = hierarchy.createFolder("Folder", null);

    hierarchy.rename(block.uuid, "Torso");
    hierarchy.rename(folderId, "Limbs");

    assert.equal(block.name, "Torso");
    assert.equal(document.folders.folders.get(folderId)?.name, "Limbs");
  });
});

describe("ModelHierarchy.duplicate", () => {
  test("copies a block next to its source with a Copy suffix and a copied region", () => {
    const { document, hierarchy, regions } = createHarness();
    const source = document.blocks.add({ name: "Arm" });

    const duplicateId = hierarchy.duplicate(source.uuid, {
      includeChildren: false,
      mirrorAxes: kNoMirror
    });

    assert.ok(duplicateId);
    assert.equal(document.blocks.get(duplicateId)?.name, "Arm Copy");
    assert.deepEqual(regions, [`copy:Arm Copy:${source.uuid}->${duplicateId}`]);
  });

  test("copies a folder subtree, keeping child names", () => {
    const { document, hierarchy } = createHarness();
    const folderId = hierarchy.createFolder("Limbs", null);
    const arm = document.blocks.add({ name: "Arm" });
    hierarchy.move(arm.uuid, folderId);

    const duplicateId = hierarchy.duplicate(folderId, {
      includeChildren: true,
      mirrorAxes: kNoMirror
    });

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Limbs", ["Arm"]],
      ["Limbs Copy", ["Arm"]]
    ]);
    assert.ok(duplicateId && document.folders.has(duplicateId));
  });

  test("mirrors every duplicated block when an axis is requested", () => {
    const { document, hierarchy } = createHarness();
    const source = document.blocks.add({ position: new THREE.Vector3(2, 0, 0) });

    const duplicateId = hierarchy.duplicate(source.uuid, {
      includeChildren: false,
      mirrorAxes: { x: true, y: false, z: false }
    });

    assert.deepStrictEqual(
      document.blocks.get(duplicateId!)?.worldPosition,
      new THREE.Vector3(-2, 0, 0)
    );
    assert.deepEqual(document.blocks.flipAxesOf(duplicateId!), { x: true, y: false, z: false });
  });

  test("returns null for an unknown source", () => {
    const { hierarchy } = createHarness();

    assert.equal(hierarchy.duplicate("missing", { includeChildren: true, mirrorAxes: kNoMirror }), null);
  });
});

describe("ModelHierarchy.remove", () => {
  test("with children, removes the whole subtree and unplaces its blocks", () => {
    const { document, hierarchy } = createHarness();
    const folderId = hierarchy.createFolder("Limbs", null);
    const arm = document.blocks.add({ name: "Arm" });
    hierarchy.move(arm.uuid, folderId);

    hierarchy.remove(folderId, { withChildren: true });

    assert.deepEqual(hierarchy.nodes(), []);
    assert.equal(document.folders.placements.size, 0);
  });

  test("without children, promotes them to the removed node's parent", () => {
    const { document, hierarchy } = createHarness();
    const root = document.blocks.add({ name: "Root" });
    const middle = document.blocks.add({ name: "Middle" });
    const leaf = document.blocks.add({ name: "Leaf" });
    document.blocks.reparentLocal(middle.uuid, root.uuid);
    document.blocks.reparentLocal(leaf.uuid, middle.uuid);

    hierarchy.remove(middle.uuid, { withChildren: false });

    assert.equal(document.blocks.get(middle.uuid), undefined);
    assert.equal(document.blocks.parentOf(leaf.uuid), root.uuid);
  });

  test("without children, removing a folder keeps its blocks at the folder's parent", () => {
    const { document, hierarchy } = createHarness();
    const folderId = hierarchy.createFolder("Limbs", null);
    const arm = document.blocks.add({ name: "Arm" });
    hierarchy.move(arm.uuid, folderId);

    hierarchy.remove(folderId, { withChildren: false });

    assert.deepEqual(shapeOf(hierarchy.nodes()), ["Arm"]);
  });
});
