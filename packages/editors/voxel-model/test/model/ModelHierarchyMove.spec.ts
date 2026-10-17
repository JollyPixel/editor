// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  at,
  createHierarchyFixture,
  readShape
} from "../fixtures/hierarchy.ts";

describe("ModelHierarchy.move", () => {
  test("moves a block in and out of a folder as one command each", () => {
    const { document, addBlock, hierarchy, commands } = createHierarchyFixture();
    const parent = addBlock();
    const folderId = hierarchy.createFolder("Folder", parent.uuid);
    const block = addBlock();
    commands.length = 0;

    hierarchy.move(block.uuid, folderId);

    assert.equal(document.tree.get(block.uuid)?.parentId, folderId);
    assert.equal(document.tree.findTransformParent(block.uuid), parent.uuid);

    hierarchy.move(block.uuid, null);

    assert.equal(document.tree.get(block.uuid)?.parentId, null);
    assert.equal(document.tree.findTransformParent(block.uuid), null);
    assert.deepEqual(
      commands.map((command) => command.action),
      ["node-moved", "node-moved"]
    );
  });

  test("keeps the world position of a block moved under another block", () => {
    const { blocks, scene, addBlock, hierarchy } = createHierarchyFixture();
    const anchor = addBlock({ transform: at(10) });
    const block = addBlock({ transform: at(3, 2) });

    hierarchy.move(block.uuid, anchor.uuid);
    scene.updateMatrixWorld(true);

    assert.equal(block.node.parent, anchor.node);
    assert.deepStrictEqual(
      blocks.get(block.uuid)?.worldPosition,
      new THREE.Vector3(3, 2, 0)
    );
    assert.deepEqual(block.transform.position, { x: -7, y: 2, z: 0 });
  });

  test("moving a folder carries the blocks of its subtree in the same command", () => {
    const { document, scene, addBlock, hierarchy, commands } = createHierarchyFixture();
    const anchor = addBlock({ transform: at(10) });
    const outer = hierarchy.createFolder("Outer", null);
    const inner = hierarchy.createFolder("Inner", outer);
    const block = addBlock({ parentId: inner, transform: at(1) });
    const nested = addBlock({ parentId: block.uuid });
    commands.length = 0;

    hierarchy.move(outer!, anchor.uuid);
    scene.updateMatrixWorld(true);

    assert.equal(document.tree.findTransformParent(block.uuid), anchor.uuid);
    assert.equal(document.tree.get(block.uuid)?.parentId, inner);
    assert.deepStrictEqual(block.worldPosition, new THREE.Vector3(1, 0, 0));
    assert.equal(commands.length, 1);
    assert.partialDeepStrictEqual(commands[0], {
      action: "node-moved",
      id: outer,
      parentId: anchor.uuid,
      transforms: [{ id: block.uuid }]
    });
    assert.equal(nested.node.parent, block.node);
  });

  test("rewrites no transform when the transform parent is unchanged", () => {
    const { addBlock, hierarchy, commands } = createHierarchyFixture();
    const folderId = hierarchy.createFolder("Folder", null);
    const block = addBlock();
    commands.length = 0;

    hierarchy.move(block.uuid, folderId);

    assert.partialDeepStrictEqual(commands[0], { transforms: [] });
  });

  test("places a node before a sibling, or last without one", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    addBlock({ name: "A" });
    const b = addBlock({ name: "B" });
    const c = addBlock({ name: "C" });

    hierarchy.move(c.uuid, null, b.uuid);
    assert.deepEqual(readShape(hierarchy.nodes()), ["A", "C", "B"]);

    hierarchy.move(c.uuid, null);
    assert.deepEqual(readShape(hierarchy.nodes()), ["A", "B", "C"]);
  });

  test("refuses to move a node into its own subtree", () => {
    const { document, hierarchy } = createHierarchyFixture();
    const outer = hierarchy.createFolder("Outer", null);
    const inner = hierarchy.createFolder("Inner", outer);

    hierarchy.move(outer!, inner);

    assert.equal(document.tree.get(outer!)?.parentId, null);
  });
});

describe("ModelHierarchy.remove", () => {
  test("with children, removes the whole subtree as one command", () => {
    const { blocks, addBlock, hierarchy, commands } = createHierarchyFixture();
    const folderId = hierarchy.createFolder("Limbs", null);
    addBlock({ name: "Arm", parentId: folderId });
    commands.length = 0;

    hierarchy.remove(folderId!, { withChildren: true });

    assert.deepEqual(hierarchy.nodes(), []);
    assert.equal(blocks.size, 0);
    assert.deepEqual(commands, [{ action: "node-removed", id: folderId }]);
  });

  test("without children, promotes them to the removed node's parent in place", () => {
    const { document, blocks, scene, addBlock, hierarchy } = createHierarchyFixture();
    const root = addBlock({ name: "Root", transform: at(1) });
    const middle = addBlock({ name: "Middle", parentId: root.uuid, transform: at(2) });
    const leaf = addBlock({ name: "Leaf", parentId: middle.uuid, transform: at(4) });

    hierarchy.remove(middle.uuid, { withChildren: false });
    scene.updateMatrixWorld(true);

    assert.equal(blocks.get(middle.uuid), undefined);
    assert.equal(document.tree.findTransformParent(leaf.uuid), root.uuid);
    assert.deepStrictEqual(leaf.worldPosition, new THREE.Vector3(7, 0, 0));
  });

  test("without children, puts them where the removed node stood", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    addBlock({ name: "First" });
    const group = hierarchy.createFolder("Group", null);
    addBlock({ name: "Last" });
    addBlock({ name: "A", parentId: group });
    addBlock({ name: "B", parentId: group });

    hierarchy.remove(group!, { withChildren: false });

    assert.deepEqual(readShape(hierarchy.nodes()), ["First", "A", "B", "Last"]);
  });

  test("without children, promotes the blocks a child folder carries", () => {
    const { document, addBlock, hierarchy } = createHierarchyFixture();
    const body = addBlock({ name: "Body" });
    const folderId = hierarchy.createFolder("Limbs", body.uuid);
    const arm = addBlock({ name: "Arm", parentId: folderId });

    hierarchy.remove(body.uuid, { withChildren: false });

    assert.deepEqual(readShape(hierarchy.nodes()), [["Limbs", ["Arm"]]]);
    assert.equal(document.tree.findTransformParent(arm.uuid), null);
    assert.equal(arm.node.parent?.type, "Scene");
  });

  test("without children, removing a folder keeps its blocks at the folder's parent", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const folderId = hierarchy.createFolder("Limbs", null);
    addBlock({ name: "Arm", parentId: folderId });

    hierarchy.remove(folderId!, { withChildren: false });

    assert.deepEqual(readShape(hierarchy.nodes()), ["Arm"]);
  });
});
