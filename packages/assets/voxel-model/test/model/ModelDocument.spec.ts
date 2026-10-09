// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ModelDocument,
  type ModelChange
} from "#src/model/ModelDocument.ts";
import { BlockTransform } from "#src/model/nodes/BlockTransform.ts";
import { BlockUvLayouts } from "#src/model/nodes/BlockUvLayouts.ts";
import { MaterialSurface } from "#src/model/materials/MaterialSurface.ts";
import type { UVLayoutData } from "#src/network/types.ts";

// CONSTANTS
const kUv: UVLayoutData = {
  state: "stacked",
  rect: { x: 0, y: 0, width: 16, height: 16 }
};

function recordChanges(
  document: ModelDocument
): ModelChange[] {
  const changes: ModelChange[] = [];
  document.on("change", (change) => changes.push(change));

  return changes;
}

describe("ModelDocument", () => {
  test("tags local block and folder edits with a local origin", () => {
    const document = new ModelDocument();
    const changes = recordChanges(document);

    const folderId = document.addFolder({ name: "Limbs" });
    const blockId = document.addBlock({ name: "Arm", parentId: folderId });
    document.rename(blockId!, "Leg");

    assert.deepEqual(
      changes.map((change) => [change.command.action, change.origin]),
      [
        ["node-added", "local"],
        ["node-added", "local"],
        ["node-renamed", "local"]
      ]
    );
    assert.deepEqual(document.tree.get(blockId!), {
      kind: "block",
      id: blockId,
      parentId: folderId,
      name: "Leg",
      transform: BlockTransform.create(),
      uv: BlockUvLayouts.net()
    });
  });

  test("refuses an edit its tree rejects, without a change", () => {
    const document = new ModelDocument();
    const changes = recordChanges(document);

    assert.equal(document.addBlock({ name: "Arm", parentId: "missing" }), null);
    assert.equal(document.rename("missing", "x"), false);
    assert.equal(document.remove("missing"), false);
    assert.deepEqual(changes, []);
  });

  test("applies a remote command once, tagged remote", () => {
    const document = new ModelDocument();
    const changes = recordChanges(document);

    document.apply({
      action: "node-added",
      node: {
        kind: "folder",
        id: "f",
        parentId: null,
        name: "Limbs"
      }
    });

    assert.equal(document.tree.has("f"), true);
    assert.deepEqual(
      changes.map((change) => change.origin),
      ["remote"]
    );
  });

  test("skips a remote command the local tree rejects", () => {
    const document = new ModelDocument();
    const a = document.addFolder({ id: "a", name: "A" });
    const b = document.addFolder({ id: "b", name: "B" });
    document.move(b!, a);
    const changes = recordChanges(document);

    const applied = document.apply({
      action: "node-moved",
      id: "a",
      parentId: "b",
      transforms: []
    });

    assert.equal(applied, false);
    assert.equal(document.tree.get("a")?.parentId, null);
    assert.deepEqual(changes, []);
  });

  test("reports every node a removal takes with it", () => {
    const document = new ModelDocument();
    const folderId = document.addFolder({ name: "Limbs" });
    const blockId = document.addBlock({ name: "Arm", parentId: folderId });
    const changes = recordChanges(document);

    document.remove(folderId!);

    assert.deepEqual(
      changes[0].image.before.nodes.map((node) => node.id),
      [folderId, blockId]
    );
    assert.equal(document.tree.size, 0);
  });

  test("reports the nodes a change replaced, as they were before it", () => {
    const document = new ModelDocument();
    const blockId = document.addBlock({ name: "Arm" });
    const before = document.tree.get(blockId!);
    const changes = recordChanges(document);

    document.rename(blockId!, "Leg");

    assert.deepEqual(changes[0].image.before.nodes, [before]);
  });

  test("loads a snapshot as one reset, with no change events", () => {
    const document = new ModelDocument();
    document.addBlock({ name: "Stale" });
    const changes = recordChanges(document);
    let resets = 0;
    document.on("reset", () => resets++);

    document.load({
      nodes: [
        {
          kind: "folder",
          id: "f",
          parentId: null,
          name: "Limbs"
        }
      ],
      materials: [],
      animationSets: []
    });

    assert.equal(resets, 1);
    assert.deepEqual(changes, []);
    assert.deepEqual(
      [...document.tree.values()].map((node) => node.id),
      ["f"]
    );
  });

  test("adds a block with its UV layout in one command", () => {
    const document = new ModelDocument();
    const changes = recordChanges(document);

    const id = document.addBlock({ name: "Arm", uv: kUv });

    assert.equal(changes.length, 1);
    assert.deepEqual(document.tree.block(id!)?.uv, kUv);
  });

  test("changes the UV layout of a block only", () => {
    const document = new ModelDocument();
    const changes = recordChanges(document);
    const blockId = document.addBlock({ name: "Arm" })!;
    const folderId = document.addFolder({ name: "Limbs" })!;

    assert.equal(document.setUv(blockId, kUv), true);
    assert.equal(document.setUv(folderId, kUv), false);

    assert.deepEqual(document.tree.block(blockId)?.uv, kUv);
    assert.deepEqual(
      changes.map((change) => change.command.action),
      ["node-added", "node-added", "node-uv-changed"]
    );
  });

  test("adds a material with the default surface and blocks pointing to it", () => {
    const document = new ModelDocument();

    const glass = document.addMaterial({ name: "Glass" })!;
    const plain = document.addBlock({ name: "Plain" })!;
    const window = document.addBlock({ name: "Window", materialId: glass })!;

    assert.deepEqual(document.tree.materials.material(glass)?.surface, MaterialSurface.create());
    assert.equal(document.tree.block(plain)?.materialId, undefined);
    assert.equal(document.tree.block(window)?.materialId, glass);
    assert.equal(document.addBlock({ name: "Ghost", materialId: "missing" }), null);
  });

  test("keeps a name another material already has, told apart by its id", () => {
    const document = new ModelDocument();
    const first = document.addMaterial({ name: "Glow" })!;
    const second = document.addMaterial({
      name: "Glow",
      surface: MaterialSurface.create({ emissive: "#ff0000" })
    })!;

    assert.notEqual(first, second);
    assert.deepEqual(
      [...document.tree.materials.values()].map(({ name }) => name),
      ["Glow", "Glow"]
    );
  });

  test("sorts materials into folders, moves them and deletes a folder with its content", () => {
    const document = new ModelDocument();
    const metals = document.addMaterialFolder({ name: "Metals" })!;
    const glass = document.addMaterial({ name: "Glass" })!;
    const steel = document.addMaterial({ name: "Steel", parentId: metals })!;
    const gold = document.addMaterial({ name: "Gold", parentId: metals, beforeId: steel })!;
    const bolt = document.addBlock({ name: "Bolt", materialId: steel })!;

    assert.equal(document.moveMaterial(glass, null, metals), true);
    assert.equal(document.moveMaterial(metals, metals), false);
    assert.equal(document.addMaterial({ name: "Lost", parentId: glass }), null);
    assert.deepEqual(
      [...document.tree.materials.values()].map(({ name }) => name),
      ["Glass", "Metals", "Gold", "Steel"]
    );

    document.removeMaterial(metals);

    assert.deepEqual([...document.tree.materials.values()].map(({ id }) => id), [glass]);
    assert.equal(document.tree.materials.has(gold), false);
    assert.equal(document.tree.block(bolt)?.materialId, undefined);
  });
});
