// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  VoxelDocument,
  type VoxelCommand,
  type VoxelCommandOrigin,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VoxelSyncClient } from "../../src/network/client.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";
import { createMockRoom } from "../helpers/room.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

interface ReceivedCommand {
  command: VoxelCommand;
  origin: VoxelCommandOrigin;
}

function makeDocument(): VoxelDocument {
  const document = new VoxelDocument({ chunkSize: 16 });
  document.world.addLayer("Ground");

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

function makeEmptySnapshot(): VoxelWorldJSON {
  return { version: 1, chunkSize: 16, tilesets: [], layers: [] };
}

function snapshotWithTileset(): VoxelWorldJSON {
  return {
    ...makeEmptySnapshot(),
    tilesets: [{ id: "stone", src: "asset-stone", tileSize: 32 }],
    defaultTileSize: 16
  };
}

const kPeerHeader = {
  clientId: "client-B",
  seq: 1,
  timestamp: 1000
};

describe("VoxelSyncClient — local commands", () => {
  it("sends a command when the world changes", () => {
    const document = makeDocument();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    document.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    });

    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "voxel-set");
    assert.equal(room.sentCommands[0].clientId, "client-A");
  });

  it("sends a whole transaction as one patch per layer", () => {
    const document = makeDocument();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    document.world.transaction(() => {
      for (let x = 0; x < 20; x++) {
        document.world.setVoxel("Ground", {
          position: { x, y: 0, z: 0 },
          blockId: 1
        });
      }
    });

    assert.deepEqual(
      room.sentCommands.map(({ action }) => action),
      ["voxels-patched"]
    );
  });

  it("stamps each command with clientId and a timestamp", () => {
    const document = makeDocument();
    const room = createMockRoom("client-B");
    const before = Date.now();
    new VoxelSyncClient({ room, document });

    document.world.addLayer("Layer1");

    const cmd = room.sentCommands[0];
    assert.equal(cmd.clientId, "client-B");
    assert.ok(cmd.timestamp >= before);
    assert.ok(cmd.timestamp <= Date.now());
  });

  it("increments seq per outbound command", () => {
    const document = makeDocument();
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.world.addLayer("L1");
    document.world.addLayer("L2");
    document.world.addLayer("L3");

    assert.deepEqual(
      room.sentCommands.map((command) => command.seq),
      [1, 2, 3]
    );
  });

  it("leaves listeners registered before it untouched", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.world.addLayer("L1");

    assert.equal(received.length, 1);
    assert.equal(room.sentCommands.length, 1);
  });
});

describe("VoxelSyncClient — remote commands", () => {
  it("applies commands from a different client to the document", () => {
    const document = makeDocument();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    room.simulateCommand(voxelSetCmd({
      x: 5,
      z: 5,
      blockId: 2,
      clientId: "client-B"
    }));

    assert.equal(
      document.world.getLayer("Ground")!.getVoxelAt({ x: 5, y: 0, z: 5 })?.blockId,
      2
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("applies a peer's patch to the document", () => {
    const document = makeDocument();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    room.simulateCommand({
      ...kPeerHeader,
      action: "voxels-patched",
      layerName: "Ground",
      metadata: { cells: [1, 0, 0, 2, 0, 3, 0, 0, 4, 0] }
    });

    const ground = document.world.getLayer("Ground")!;
    assert.equal(ground.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, 2);
    assert.equal(ground.getVoxelAt({ x: 3, y: 0, z: 0 })?.blockId, 4);
    assert.equal(room.sentCommands.length, 0);
  });

  it("notifies local listeners with a remote origin", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    room.simulateCommand(voxelSetCmd({ clientId: "client-B" }));

    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["voxel-set", "remote"]]
    );
  });

  it("does not apply its own echoed command", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    room.simulateCommand(voxelSetCmd({ clientId: "client-A" }));

    assert.equal(
      document.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 }),
      undefined
    );
    assert.equal(received.length, 0);
  });

  it("ignores a world-replace command", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    room.simulateCommand({
      ...kPeerHeader,
      action: "world-replace",
      data: makeEmptySnapshot()
    });

    assert.ok(document.world.getLayer("Ground"));
    assert.equal(received.length, 0);
  });
});

describe("VoxelSyncClient — snapshot loading", () => {
  it("loads a snapshot into the document", () => {
    const document = makeDocument();
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    room.simulateSnapshot(snapshotWithTileset());

    assert.deepEqual(document.tilesets.definitions().map(({ id }) => id), ["stone"]);
    assert.equal(document.defaultTileSize, 16);
    assert.equal(document.world.getLayer("Ground"), undefined);
    assert.equal(room.sentCommands.length, 0);
  });
});

describe("VoxelSyncClient — replaceWorld", () => {
  it("sends a stamped world-replace command carrying the data", () => {
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room, document: makeDocument() });

    const data = makeEmptySnapshot();
    client.replaceWorld(data);

    assert.equal(room.sentCommands.length, 1);
    const cmd = room.sentCommands[0];
    assert.equal(cmd.action, "world-replace");
    assert.equal(cmd.clientId, "client-A");
    assert.ok(cmd.seq >= 1);
    assert.ok("data" in cmd && cmd.data === data);
  });
});

describe("VoxelSyncClient — destroy", () => {
  it("stops listening for room messages and leaves the room to its lease", () => {
    const document = makeDocument();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, document });

    client.destroy();
    room.simulateSnapshot(snapshotWithTileset());

    assert.deepEqual(document.tilesets.definitions(), []);
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

describe("VoxelSyncClient — block commands", () => {
  it("publishes a local definition", () => {
    const document = makeDocument();
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.defineBlock(makeBlockDef(4, "slope"));

    assert.equal(room.sentCommands.length, 1);
    const [command] = room.sentCommands;
    assert.equal(
      command.action === "block-defined" ? command.block.shapeId : null,
      "slope"
    );
    assert.equal(command.clientId, "client-A");
  });

  it("publishes a local removal, and nothing for an unknown id", () => {
    const document = makeDocument();
    document.defineBlock(makeBlockDef(4, "cube"));
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.removeBlock(99);
    assert.equal(room.sentCommands.length, 0);

    document.removeBlock(4);
    const [command] = room.sentCommands;
    assert.equal(
      command.action === "block-removed" ? command.blockId : null,
      4
    );
  });

  it("publishes one command per block of a batch", () => {
    const document = makeDocument();
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.defineBlocks([
      makeBlockDef(4, "slope"),
      makeBlockDef(5, "cube")
    ]);

    assert.deepEqual(
      room.sentCommands.map((command) => command.action),
      ["block-defined", "block-defined"]
    );
  });

  it("registers a peer definition without re-publishing it", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    room.simulateCommand({
      ...kPeerHeader,
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope"))
    });

    assert.equal(document.blocks.get(4)?.shapeId, "slope");
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["block-defined", "remote"]]
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("stays quiet when a peer removal names an unknown block", () => {
    const document = makeDocument();
    const received = record(document);
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    room.simulateCommand({
      ...kPeerHeader,
      action: "block-removed",
      blockId: 99
    });

    assert.equal(received.length, 0);
  });

  it("ignores the echo of its own block command", () => {
    const document = makeDocument();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, document });

    room.simulateCommand({
      ...kPeerHeader,
      clientId: "client-A",
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope"))
    });

    assert.equal(document.blocks.has(4), false);
  });
});

describe("VoxelSyncClient — block reorder", () => {
  function makeDocumentWithBlocks(): VoxelDocument {
    const document = makeDocument();
    document.defineBlocks([
      makeBlockDef(1, "cube"),
      makeBlockDef(2, "cube"),
      makeBlockDef(3, "cube")
    ]);

    return document;
  }

  function ids(
    document: VoxelDocument
  ): number[] {
    return [...document.blocks].map((block) => block.id);
  }

  it("publishes a local move", () => {
    const document = makeDocumentWithBlocks();
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    document.moveBlock(3, 0);

    assert.equal(room.sentCommands.length, 1);
    const [command] = room.sentCommands;
    assert.deepEqual(
      command.action === "block-moved" ?
        [command.blockId, command.toIndex] :
        null,
      [3, 0]
    );
  });

  it("applies a peer move without re-publishing it", () => {
    const document = makeDocumentWithBlocks();
    const room = createMockRoom();
    new VoxelSyncClient({ room, document });

    room.simulateCommand({
      ...kPeerHeader,
      action: "block-moved",
      blockId: 1,
      toIndex: 2
    });

    assert.deepEqual(ids(document), [2, 3, 1]);
    assert.equal(room.sentCommands.length, 0);
  });
});

describe("VoxelSyncClient — tilesets", () => {
  function makeClient() {
    const document = makeDocument();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, document });
    room.simulateSnapshot(snapshotWithTileset());
    const received = record(document);

    return { document, received, room, client };
  }

  it("applies a remote tileset command without echoing it", () => {
    const { document, received, room } = makeClient();

    room.simulateCommand({
      ...kPeerHeader,
      action: "tileset-added",
      tileset: { id: "wood", src: "asset-wood", tileSize: 16 }
    });

    assert.deepEqual(document.tilesets.definitions().map(({ id }) => id), ["stone", "wood"]);
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["tileset-added", "remote"]]
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("rescales the document blocks on a remote resize without echoing them", () => {
    const { document, room } = makeClient();
    document.blocks.register(makeBlockDef(1, "cube", {
      defaultTexture: { col: 1, row: 1, tilesetId: "stone" }
    }));

    room.simulateCommand({
      ...kPeerHeader,
      action: "tileset-resized",
      tilesetId: "stone",
      tileSize: 16
    });

    assert.deepEqual(document.blocks.get(1)?.defaultTexture, {
      col: 2,
      row: 2,
      tilesetId: "stone",
      size: 32
    });
    assert.equal(room.sentCommands.length, 0);
  });

  it("sends a local tileset change", () => {
    const { document, received, room } = makeClient();

    assert.equal(document.removeTileset("stone"), true);

    assert.deepEqual(document.tilesets.definitions(), []);
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["tileset-removed", "local"]]
    );
    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "tileset-removed");
  });

  it("sends nothing for a local change that does not apply", () => {
    const { document, room } = makeClient();

    assert.equal(document.removeTileset("missing"), false);
    assert.equal(room.sentCommands.length, 0);
  });
});
