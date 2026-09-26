// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SyncedModelDocument,
  voxelModelDocumentKind
} from "#src/network/SyncedModelDocument.ts";
import { VOXEL_MODEL_KIND } from "#src/asset/voxelModel.ts";
import { createMockRoom } from "../helpers/room.ts";
import { networkCommand } from "../helpers/commands.ts";

// CONSTANTS
const kSnapshot = {
  nodes: [
    {
      kind: "folder" as const,
      id: "limbs",
      parentId: null,
      name: "Limbs"
    }
  ]
};

describe("SyncedModelDocument", () => {
  test("is ready once the first snapshot is loaded", async() => {
    const room = createMockRoom();
    const synced = new SyncedModelDocument(room);
    let settled = false;
    void synced.ready.then(() => {
      settled = true;
    });

    await Promise.resolve();
    assert.strictEqual(settled, false);

    room.deliverSnapshot(kSnapshot);
    await synced.ready;

    assert.strictEqual(synced.document.tree.get("limbs")?.name, "Limbs");
    synced.dispose();
  });

  test("sends local edits and applies remote ones without echoing", () => {
    const room = createMockRoom();
    const synced = new SyncedModelDocument(room);
    room.deliverSnapshot({ nodes: [] });

    synced.document.addFolder({
      id: "local",
      name: "Local"
    });

    assert.strictEqual(room.sent.length, 1);
    assert.strictEqual(room.sent[0].action, "node-added");

    room.deliverCommand(networkCommand({
      action: "node-added",
      node: {
        kind: "folder",
        id: "remote",
        parentId: null,
        name: "Remote"
      }
    }, { clientId: "client-B" }));

    assert.strictEqual(synced.document.tree.get("remote")?.name, "Remote");
    assert.strictEqual(room.sent.length, 1);
    synced.dispose();
  });

  test("stops forwarding local edits once disposed", () => {
    const room = createMockRoom();
    const synced = new SyncedModelDocument(room);
    room.deliverSnapshot({ nodes: [] });

    synced.dispose();
    synced.document.addFolder({
      id: "after",
      name: "After"
    });

    assert.strictEqual(room.sent.length, 0);
    assert.strictEqual(room.leaves, 0);
  });
});

describe("voxelModelDocumentKind", () => {
  test("builds a synced document for the voxel-model asset kind", () => {
    const kind = voxelModelDocumentKind();
    const room = createMockRoom();

    assert.strictEqual(kind.kind, VOXEL_MODEL_KIND);

    const synced = kind.createDocument(room);

    assert.ok(synced instanceof SyncedModelDocument);
    synced.dispose();
  });
});
