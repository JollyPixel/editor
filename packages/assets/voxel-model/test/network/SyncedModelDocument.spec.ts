// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  SyncedModelDocument,
  voxelModelDocumentKind
} from "#src/network/SyncedModelDocument.ts";
import { VOXEL_MODEL_KIND } from "#src/asset/voxelModel.ts";
import { modelHistoryKeys } from "#src/model/history/modelHistoryKeys.ts";
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
  ],
  materials: [],
  animationSets: []
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
    room.deliverSnapshot({ nodes: [], materials: [], animationSets: [] });

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

  test("converges on concurrent moves forming a cycle once the server resyncs", () => {
    const room = createMockRoom();
    const synced = new SyncedModelDocument(room);
    const folderA = { kind: "folder" as const, id: "a", parentId: null, name: "A" };
    const folderB = { kind: "folder" as const, id: "b", parentId: null, name: "B" };
    room.deliverSnapshot({ nodes: [folderA, folderB], materials: [], animationSets: [] });

    synced.document.move("b", "a");
    synced.document.rename("a", "Renamed");
    room.deliverCommand(networkCommand({
      action: "node-moved",
      id: "a",
      parentId: "b",
      transforms: []
    }, { clientId: "client-B" }));
    room.deliverSnapshot({
      nodes: [folderB, { ...folderA, parentId: "b" }],
      materials: [],
      animationSets: []
    });
    room.deliverCommand(room.sent[1]);

    const { tree } = synced.document;
    assert.strictEqual(tree.get("a")?.parentId, "b");
    assert.strictEqual(tree.get("b")?.parentId, null);
    assert.strictEqual(tree.get("a")?.name, "Renamed");
    synced.dispose();
  });

  test("an undo carries the version its step landed at, and a peer edit after it refuses the step", () => {
    const room = createMockRoom();
    const synced = new SyncedModelDocument(room);
    room.deliverSnapshot(kSnapshot);
    const history = new CommandHistory<"model">();
    history.register({
      id: "model",
      document: synced.document,
      keys: modelHistoryKeys(synced.document.tree),
      scopeOf: () => "model"
    });

    synced.document.rename("limbs", "Arms");
    room.deliver({ type: "command", data: room.sent[0], version: 7 });
    history.undo("model");
    assert.strictEqual(room.sent.at(-1)?.basis, 7);

    history.redo("model");
    room.deliver({ type: "command", data: room.sent[1], version: 8 });
    room.deliver({ type: "command", data: room.sent[2], version: 9 });
    room.deliverCommand(networkCommand(
      { action: "node-renamed", id: "limbs", name: "Peer" },
      { clientId: "client-B" }
    ));

    assert.strictEqual(history.state("model").canUndo, false);
    synced.dispose();
  });

  test("stops forwarding local edits once disposed", () => {
    const room = createMockRoom();
    const synced = new SyncedModelDocument(room);
    room.deliverSnapshot({ nodes: [], materials: [], animationSets: [] });

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
