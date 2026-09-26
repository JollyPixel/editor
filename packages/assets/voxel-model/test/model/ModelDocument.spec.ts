// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ModelDocument,
  type ModelChange
} from "#src/model/ModelDocument.ts";
import { createBlockTransform } from "#src/model/blockTransform.ts";
import { createBlockUv } from "#src/model/blockUv.ts";
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
      transform: createBlockTransform(),
      uv: createBlockUv()
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

  test("reports every node a removal takes with it", () => {
    const document = new ModelDocument();
    const folderId = document.addFolder({ name: "Limbs" });
    const blockId = document.addBlock({ name: "Arm", parentId: folderId });
    const changes = recordChanges(document);

    document.remove(folderId!);

    assert.deepEqual(
      changes[0].removed.map((node) => node.id),
      [folderId, blockId]
    );
    assert.equal(document.tree.size, 0);
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
      ]
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
});
