// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { UVLayoutData } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  NO_MIRROR,
  at,
  createHierarchyFixture,
  readShape
} from "../fixtures/hierarchy.ts";

function layoutAt(
  x: number
): UVLayoutData {
  return {
    state: "stacked",
    rect: { x, y: 0, width: 16, height: 16 }
  };
}

describe("ModelHierarchy.duplicate", () => {
  test("copies a block under the given name with its UV layout", () => {
    const { document, blocks, addBlock, hierarchy } = createHierarchyFixture();
    const source = addBlock({
      name: "Arm",
      transform: at(1, 2, 3),
      uv: layoutAt(7)
    });

    const duplicateId = hierarchy.duplicate(source.uuid, {
      name: "Left Arm",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });

    assert.ok(duplicateId);
    assert.equal(blocks.get(duplicateId)?.name, "Left Arm");
    assert.deepEqual(blocks.get(duplicateId)?.transform, source.transform);
    assert.deepEqual(document.tree.block(duplicateId)?.uv, layoutAt(7));
  });

  test("gives the copy of a block the same material and shape", () => {
    const { document, blocks, addBlock, hierarchy } = createHierarchyFixture();
    const metalId = document.addMaterial({ name: "Metal" })!;
    const source = addBlock({ materialId: metalId, shape: { type: "plane" } });

    const duplicateId = hierarchy.duplicate(source.uuid, {
      name: "Copy",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });

    assert.equal(document.tree.block(duplicateId!)?.materialId, metalId);
    assert.equal(document.tree.materials.size, 1);
    assert.deepEqual(document.tree.block(duplicateId!)?.shape, { type: "plane" });
    assert.deepEqual(blocks.get(duplicateId!)?.shape, { type: "plane" });
  });

  test("copies a folder subtree, renaming the blocks that keep their block parent", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const folderId = hierarchy.createFolder("Limbs", null);
    const arm = addBlock({ name: "Arm", parentId: folderId });
    addBlock({ name: "Hand", parentId: arm.uuid });

    const duplicateId = hierarchy.duplicate(folderId!, {
      name: "Limbs Copy",
      includeChildren: true,
      mirrorAxes: NO_MIRROR
    });

    assert.deepEqual(readShape(hierarchy.nodes()), [
      ["Limbs", [["Arm", ["Hand"]]]],
      ["Limbs Copy", [["Arm 2", ["Hand"]]]]
    ]);
    assert.ok(duplicateId && hierarchy.isFolder(duplicateId));
  });

  test("never gives the copied block a sibling's name", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const source = addBlock({ name: "Arm" });
    addBlock({ name: "Arm Copy" });

    const duplicateId = hierarchy.duplicate(source.uuid, {
      name: "Arm Copy",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });

    assert.equal(hierarchy.nodes().find(({ id }) => id === duplicateId)?.name, "Arm Copy 2");
  });

  test("leaves the children behind unless asked for them", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const body = addBlock({ name: "Body" });
    addBlock({ name: "Head", parentId: body.uuid });

    hierarchy.duplicate(body.uuid, {
      name: "Body Copy",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });

    assert.deepEqual(readShape(hierarchy.nodes()), [
      ["Body", ["Head"]],
      "Body Copy"
    ]);
  });

  test("lands right after its source among its siblings", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const folderId = hierarchy.createFolder("Limbs", null);
    const arm = addBlock({ name: "Arm", parentId: folderId });
    addBlock({ name: "Leg", parentId: folderId });
    const torso = addBlock({ name: "Torso" });
    addBlock({ name: "Head" });

    hierarchy.duplicate(arm.uuid, {
      name: "Arm Copy",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });
    hierarchy.duplicate(torso.uuid, {
      name: "Torso Copy",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });

    assert.deepEqual(readShape(hierarchy.nodes()), [
      ["Limbs", ["Arm", "Arm Copy", "Leg"]],
      "Torso",
      "Torso Copy",
      "Head"
    ]);
  });

  test("adds a copy in place as one command", () => {
    const { addBlock, hierarchy, commands } = createHierarchyFixture();
    const arm = addBlock({ name: "Arm" });
    addBlock({ name: "Leg" });
    commands.length = 0;

    hierarchy.duplicate(arm.uuid, {
      name: "Arm Copy",
      includeChildren: false,
      mirrorAxes: NO_MIRROR
    });

    assert.deepEqual(commands.map(({ action }) => action), ["node-added"]);
  });

  test("mirrors every duplicated block when an axis is requested", () => {
    const { document, blocks, addBlock, hierarchy } = createHierarchyFixture();
    const source = addBlock({ transform: at(2) });
    const mirrorAxes = { x: true, y: false, z: false };

    const duplicateId = hierarchy.duplicate(source.uuid, {
      name: "Mirror",
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
    const { hierarchy } = createHierarchyFixture();

    assert.equal(
      hierarchy.duplicate("missing", { name: "Copy", includeChildren: true, mirrorAxes: NO_MIRROR }),
      null
    );
  });
});
