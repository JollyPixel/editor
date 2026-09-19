// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ModelDocument,
  type ModelChange
} from "#src/model/index.ts";

function recordChanges(
  document: ModelDocument
): ModelChange[] {
  const changes: ModelChange[] = [];
  document.on("change", (change) => changes.push(change));

  return changes;
}

describe("ModelDocument", () => {
  test("tags local block and folder edits with a local origin", () => {
    const document = new ModelDocument(new THREE.Scene());
    const changes = recordChanges(document);

    const block = document.blocks.add({ name: "Block" });
    const folderId = document.folders.add({ name: "Folder" });

    assert.deepEqual(
      changes.map(({ command, origin }) => [command.action, origin]),
      [
        ["group-added", "local"],
        ["folder-added", "local"]
      ]
    );
    assert.ok(document.blocks.get(block.uuid));
    assert.ok(document.folders.has(folderId));
  });

  test("applies a remote command once, tagged remote, without a local echo", () => {
    const document = new ModelDocument(new THREE.Scene());
    const block = document.blocks.add({ name: "Block" });
    const changes = recordChanges(document);

    document.apply({ action: "group-renamed", uuid: block.uuid, name: "Torso" });
    document.apply({ action: "folder-added", uuid: "f1", name: "Remote", parentId: null });

    assert.equal(block.name, "Torso");
    assert.ok(document.folders.has("f1"));
    assert.deepEqual(
      changes.map(({ command, origin }) => [command.action, origin]),
      [
        ["group-renamed", "remote"],
        ["folder-added", "remote"]
      ]
    );
  });

  test("loads a snapshot as one reset, with no change events", () => {
    const document = new ModelDocument(new THREE.Scene());
    const changes = recordChanges(document);
    let resets = 0;
    document.on("reset", () => resets++);

    document.load({
      nodes: [
        {
          uuid: "block",
          name: "Block",
          parentUuid: null,
          position: { x: 0, y: 0, z: 0 },
          pivotOffset: { x: 0, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          scale: { x: 1, y: 1, z: 1 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      folders: [{ uuid: "f1", name: "Folder", parentId: null }],
      placements: [{ blockUuid: "block", folderId: "f1" }]
    });

    assert.equal(resets, 1);
    assert.deepEqual(changes, []);
    assert.ok(document.blocks.get("block"));
    assert.equal(document.folders.placements.get("block"), "f1");
  });
});
