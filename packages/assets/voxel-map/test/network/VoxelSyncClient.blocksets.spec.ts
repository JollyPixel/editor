// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  VoxelDocument,
  type VoxelCommand,
  type VoxelCommandOrigin,
  type VoxelWorldJSON,
  VOXEL_WORLD_VERSION
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VoxelSyncClient } from "../../src/network/client.ts";
import { createMockRoom } from "../helpers/room.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

interface ReceivedCommand {
  command: VoxelCommand;
  origin: VoxelCommandOrigin;
}

function makeDocument(): VoxelDocument {
  const document = new VoxelDocument({ chunkSize: 16 });
  document.world.restoreLayer({ id: "Ground", name: "Ground" });

  return document;
}

function record(
  document: VoxelDocument
): ReceivedCommand[] {
  const received: ReceivedCommand[] = [];
  document.on("command", (command, { origin }) => received.push({
    command,
    origin
  }));

  return received;
}

function snapshotWithBlockset(): VoxelWorldJSON {
  return {
    ...makeEmptySnapshot(),
    blocksets: [{ id: "stone", src: "asset-stone", tileSize: 32 }]
  };
}

function makeEmptySnapshot(): VoxelWorldJSON {
  return {
    version: VOXEL_WORLD_VERSION,
    chunkSize: 16,
    blocksets: [],
    layers: []
  };
}

const kPeerHeader = {
  clientId: "client-B",
  seq: 1,
  timestamp: 1000
};

describe("VoxelSyncClient — destroy", () => {
  it("stops listening for room messages and leaves the room to its lease", () => {
    const document = makeDocument();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, document });

    client.destroy();
    room.simulateSnapshot(snapshotWithBlockset());

    assert.deepEqual(document.blocksets.definitions(), []);
    assert.equal(room.left, false);
  });

  it("stops forwarding local commands and keeps other listeners", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, document });

    client.destroy();
    document.world.addLayer("L");

    assert.equal(room.sentCommands.length, 0);
    assert.equal(received.length, 1);
  });
});

describe("VoxelSyncClient — blocksets", () => {
  function makeClient() {
    const document = makeDocument();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, document });
    room.simulateSnapshot(snapshotWithBlockset());
    const received = record(document);

    return { document, received, room, client };
  }

  it("applies a remote blockset command without echoing it", () => {
    const { document, received, room } = makeClient();

    room.simulateCommand({
      ...kPeerHeader,
      action: "blockset-added",
      blockset: { id: "wood", src: "asset-wood", tileSize: 16 }
    });

    assert.deepEqual(document.blocksets.definitions().map(({ id }) => id), ["stone", "wood"]);
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["blockset-added", "remote"]]
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("sends a local blockset change", () => {
    const { document, received, room } = makeClient();

    assert.equal(document.removeBlockset("stone"), true);

    assert.deepEqual(document.blocksets.definitions(), []);
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["blockset-removed", "local"]]
    );
    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "blockset-removed");
  });

  it("sends nothing for a local change that does not apply", () => {
    const { document, room } = makeClient();

    assert.equal(document.removeBlockset("missing"), false);
    assert.equal(room.sentCommands.length, 0);
  });
});

describe("VoxelSyncClient — block commands stay local", () => {
  it("keeps a local block definition off the wire", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.defineBlock(makeBlockDef(4, "slope"));
    document.defineMaterialGroup({ id: "gold" });

    assert.equal(document.blocks.get(4)?.shapeId, "slope");
    assert.deepEqual(
      received.map(({ command }) => command.action),
      ["block-defined", "material-group-defined"]
    );
    assert.equal(room.sentCommands.length, 0);
  });
});
