// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { BlockUvLayouts } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { HierarchyNode } from "#src/model/index.ts";
import {
  NO_MIRROR,
  at,
  createHierarchyFixture,
  shapeOf
} from "../fixtures/hierarchy.ts";

describe("ModelHierarchy.nodes", () => {
  test("lists nodes in document order under their folder or block parent", () => {
    const { document, addBlock, hierarchy } = createHierarchyFixture();
    addBlock({ name: "Body" });
    const folderId = document.addFolder({ name: "Arms" });
    const arm = addBlock({ name: "Arm", parentId: folderId });
    addBlock({ name: "Hand", parentId: arm.uuid });

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      "Body",
      ["Arms", [["Arm", ["Hand"]]]]
    ]);
    assert.equal(hierarchy.nodes()[1].kind, "folder");
  });

  test("nests folders under folders, and a folder under a block beside its children", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const body = addBlock({ name: "Body" });
    addBlock({ name: "Head", parentId: body.uuid });
    const outer = hierarchy.createFolder("Outer", body.uuid);
    hierarchy.createFolder("Inner", outer);

    assert.deepEqual(shapeOf(hierarchy.nodes()), [
      ["Body", ["Head", ["Outer", ["Inner"]]]]
    ]);
  });

  test("carries a block's material, and none for a folder", () => {
    const { document, addBlock, hierarchy } = createHierarchyFixture();
    const metalId = document.addMaterial({ name: "Metal" })!;
    addBlock({ name: "Plain" });
    addBlock({ name: "Metal", materialId: metalId });
    document.addFolder({ name: "Limbs" });

    assert.deepEqual(
      hierarchy.nodes().map((node) => node.material?.id ?? null),
      [null, metalId, null]
    );
  });

  test("labels unnamed nodes by kind", () => {
    const { document, hierarchy } = createHierarchyFixture();
    document.addFolder({ name: "" });
    document.addBlock({ name: "" });

    assert.deepEqual(shapeOf(hierarchy.nodes()), ["Folder", "Block"]);
  });
});

describe("ModelHierarchy.createBlock", () => {
  test("creates the block and its UV layout with one command", () => {
    const { document, hierarchy, commands } = createHierarchyFixture();

    const uuid = hierarchy.createBlock("Head", null);

    assert.ok(uuid);
    assert.deepEqual(document.tree.block(uuid)?.uv, BlockUvLayouts.net());
    assert.deepEqual(commands.map((command) => command.action), ["node-added"]);
  });

  test("places the new block's net beside the layouts already in use", () => {
    const { document, hierarchy } = createHierarchyFixture();

    const first = hierarchy.createBlock("Head", null);
    const second = hierarchy.createBlock("Body", null);
    const net = new BlockUvLayouts([BlockUvLayouts.net()]).extent;

    assert.ok(first && second);
    assert.deepEqual(
      document.tree.block(second)?.uv,
      BlockUvLayouts.net({ x: net.x, y: 0 })
    );
  });

  test("under a block, lands on the parent's position as its child", () => {
    const { document, blocks, addBlock, hierarchy } = createHierarchyFixture();
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
    const { document, blocks, addBlock, hierarchy } = createHierarchyFixture();
    const parent = addBlock();
    const folderId = hierarchy.createFolder("Folder", parent.uuid);

    const uuid = hierarchy.createBlock("Child", folderId);

    assert.ok(uuid);
    assert.equal(document.tree.get(uuid)?.parentId, folderId);
    assert.equal(blocks.get(uuid)?.node.parent, parent.node);
  });

  test("returns null and adds nothing under an unknown parent", () => {
    const { document, hierarchy } = createHierarchyFixture();

    assert.equal(hierarchy.createBlock("Child", "missing"), null);
    assert.equal(document.tree.size, 0);
  });
});

describe("ModelHierarchy.rename", () => {
  test("renames blocks and folders alike", () => {
    const { document, addBlock, hierarchy } = createHierarchyFixture();
    const block = addBlock({ name: "Block" });
    const folderId = hierarchy.createFolder("Folder", null);

    hierarchy.rename(block.uuid, "Torso");
    hierarchy.rename(folderId!, "Limbs");

    assert.equal(block.name, "Torso");
    assert.equal(document.tree.get(folderId!)?.name, "Limbs");
  });
});

describe("ModelHierarchy block names", () => {
  test("refuses a block rename that clashes, naming the block parent", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const body = addBlock({ name: "Body" });
    const arm = addBlock({ name: "Arm", parentId: body.uuid });
    addBlock({ name: "Leg", parentId: body.uuid });
    const folderId = hierarchy.createFolder("Leg", body.uuid);

    assert.equal(
      hierarchy.renameError(arm.uuid, "leg"),
      "\"Body\" already has a block named \"leg\""
    );
    assert.equal(hierarchy.renameError(arm.uuid, "ARM"), null);
    assert.equal(hierarchy.renameError(folderId!, "Arm"), null);
    assert.equal(
      hierarchy.blockNameError("Body", null),
      "A root block is already named \"Body\""
    );
  });

  test("flags every block sharing a name with a sibling block", () => {
    const { addBlock, hierarchy } = createHierarchyFixture();
    const body = addBlock({ name: "Body" });
    const first = addBlock({ name: "Arm", parentId: body.uuid });
    const folderId = hierarchy.createFolder("Limbs", body.uuid);
    const second = addBlock({ name: "arm", parentId: folderId });
    addBlock({ name: "Arm" });

    const clashes = new Map(
      hierarchy.nodes()
        .flatMap(function flatten(node): HierarchyNode[] {
          return [node, ...node.children.flatMap(flatten)];
        })
        .filter((node) => node.nameClash !== undefined)
        .map((node) => [node.id, node.nameClash])
    );

    assert.deepEqual(clashes, new Map([
      [first.uuid, "Another block in \"Body\" is named \"Arm\""],
      [second.uuid, "Another block in \"Body\" is named \"arm\""]
    ]));
  });
});

describe("ModelHierarchy.reshape", () => {
  const kPlane = { type: "plane" } as const;
  const kTextureSize = { x: 256, y: 256 };

  test("swaps the shape and its UV net in one command, keeping the net where it was", () => {
    const { document, hierarchy, commands } = createHierarchyFixture();
    hierarchy.createBlock("Head", null);
    const body = hierarchy.createBlock("Body", null)!;
    const origin = { x: new BlockUvLayouts([BlockUvLayouts.net()]).extent.x, y: 0 };
    commands.length = 0;

    assert.equal(hierarchy.reshape(body, kPlane), true);
    assert.equal(hierarchy.reshape(body, kPlane), false);

    assert.deepEqual(document.tree.block(body)?.shape, kPlane);
    assert.deepEqual(document.tree.block(body)?.uv, BlockUvLayouts.net(origin, kPlane));
    assert.deepEqual(commands.map(({ action }) => action), ["node-shape-changed"]);
  });

  test("moves the net to free texture space when the new shape would overlap another block", () => {
    const { document, hierarchy } = createHierarchyFixture();
    const floor = hierarchy.createBlock("Floor", null, kPlane)!;
    const wall = hierarchy.createBlock("Wall", null, kPlane)!;
    const others = new BlockUvLayouts([document.tree.block(wall)!.uv]);

    assert.equal(hierarchy.reshape(floor, { type: "box" }), true);

    assert.equal("shape" in document.tree.block(floor)!, false);
    assert.deepEqual(
      document.tree.block(floor)?.uv,
      others.nextNet(kTextureSize, { type: "box" })
    );
  });

  test("needs transform rights rather than hierarchy rights", () => {
    const { access, hierarchy, commands } = createHierarchyFixture();
    const head = hierarchy.createBlock("Head", null)!;
    commands.length = 0;

    access.grant("hierarchy");
    assert.equal(hierarchy.reshape(head, kPlane), false);
    assert.deepEqual(commands, []);

    access.grant("transforms");
    assert.equal(hierarchy.reshape(head, kPlane), true);
  });
});

describe("ModelHierarchy access", () => {
  test("sends no node command without hierarchy rights, and mirrors only with transform rights", () => {
    const { access, addBlock, commands, hierarchy } = createHierarchyFixture();
    const arm = addBlock({ name: "Arm" });
    const legId = hierarchy.createFolder("Legs", null)!;
    commands.length = 0;
    access.grant("transforms");

    assert.equal(hierarchy.createBlock("Head", null), null);
    assert.equal(hierarchy.createFolder("Props", null), null);
    hierarchy.rename(arm.uuid, "Wing");
    hierarchy.move(arm.uuid, legId);
    hierarchy.remove(arm.uuid, { withChildren: true });
    hierarchy.duplicate(arm.uuid, { name: "Copy", includeChildren: false, mirrorAxes: NO_MIRROR });
    assert.deepEqual(commands, []);

    access.grant("hierarchy");
    const mirrored = hierarchy.duplicate(arm.uuid, {
      name: "Mirror",
      includeChildren: false,
      mirrorAxes: { x: true, y: false, z: false }
    });
    assert.deepEqual([mirrored, commands], [null, []]);

    hierarchy.rename(arm.uuid, "Wing");
    assert.deepEqual(commands.map(({ action }) => action), ["node-renamed"]);
  });
});
