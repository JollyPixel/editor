// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ModelDocument,
  voxelModelAssetKind,
  type VoxelModelState
} from "#src/index.ts";
import { ModelSyncClient } from "#src/network/ModelSyncClient.ts";
import type {
  VoxelModelNetworkCommand,
  VoxelModelServerMessage
} from "#src/network/types.ts";
import {
  TRANSFORM,
  blockAdded,
  folderAdded,
  networkCommand
} from "../helpers/commands.ts";
import { LiveRoom } from "../helpers/liveRoom.ts";
import { createMockRoom } from "../helpers/room.ts";

function nodeIds(
  nodes: Iterable<{ id: string; }>
): string[] {
  return [...nodes].map((node) => node.id).sort();
}

function setup() {
  const server = new LiveRoom<VoxelModelState, VoxelModelNetworkCommand>(
    voxelModelAssetKind()
  );
  server.receive("A", networkCommand(folderAdded("N"), { clientId: "A" }));
  server.receive("A", networkCommand(blockAdded("M"), { clientId: "A" }));
  server.receive("A", networkCommand(blockAdded("K"), { clientId: "A" }));

  const room = createMockRoom("B");
  const document = new ModelDocument();
  new ModelSyncClient({ room, document });

  function deliver(): void {
    for (const message of server.take("B")) {
      room.deliver(message as VoxelModelServerMessage);
    }
  }

  server.connect("B");
  deliver();

  return {
    server,
    document,
    deliver,
    flush(): void {
      for (const sent of room.sent.splice(0)) {
        server.receive("B", sent);
      }
    }
  };
}

describe("voxel-model convergence", () => {
  test("C3: a node moved into a folder the author removed is removed with it", () => {
    const { server, document, deliver, flush } = setup();

    document.remove("N");
    server.receive("A", networkCommand({
      action: "node-moved",
      id: "M",
      parentId: "N",
      transforms: []
    }, { clientId: "A" }));
    flush();
    deliver();

    assert.deepStrictEqual(nodeIds(server.state.snapshot().nodes), ["K"]);
    assert.deepStrictEqual(nodeIds(document.tree.values()), ["K"]);
  });

  test("a rebased pending removal keeps the server sibling order", () => {
    const { server, document, deliver, flush } = setup();

    document.remove("M");
    server.receive("A", networkCommand(blockAdded("Z"), { clientId: "A" }));
    deliver();
    flush();
    deliver();

    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a pending move into a folder a peer removed leaves the view until the server repairs it", () => {
    const { server, document, deliver, flush } = setup();

    document.move("M", "N");
    server.receive("A", networkCommand({ action: "node-removed", id: "N" }, { clientId: "A" }));
    deliver();
    assert.deepStrictEqual(nodeIds(document.tree.values()), ["K", "M"]);
    assert.strictEqual(document.tree.get("M")?.parentId, null);

    flush();
    deliver();

    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });

  test("a newer local transform survives an older peer transform", () => {
    const { server, document, deliver, flush } = setup();
    const moved = {
      ...TRANSFORM,
      position: { x: 4, y: 0, z: 0 }
    };

    document.transform("M", moved);
    server.receive("A", networkCommand({
      action: "node-transformed",
      id: "M",
      transform: { ...TRANSFORM, position: { x: 9, y: 9, z: 9 } }
    }, { clientId: "A", timestamp: 1 }));
    flush();
    deliver();

    assert.deepStrictEqual(document.tree.block("M")?.transform, moved);
    assert.deepStrictEqual(
      [...document.tree.values()],
      server.state.snapshot().nodes
    );
  });
});
