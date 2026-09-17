// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import {
  resolveBlockDefinition,
  VoxelEngine,
  type VoxelCommand,
  type VoxelCommandOrigin,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  type VoxelNetworkCommand,
  type VoxelServerMessage,
  VoxelSyncClient
} from "../../src/network/client.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

interface ReceivedCommand {
  command: VoxelCommand;
  origin: VoxelCommandOrigin;
}

function makeEngine(): VoxelEngine {
  const engine = new VoxelEngine({ chunkSize: 16 });
  engine.world.addLayer("Ground");

  return engine;
}

function record(
  engine: VoxelEngine
): ReceivedCommand[] {
  const received: ReceivedCommand[] = [];
  engine.on("command", (command, { origin }) => received.push({
    command,
    origin
  }));

  return received;
}

interface MockRoom extends network.Room<VoxelNetworkCommand, VoxelServerMessage> {
  sentCommands: VoxelNetworkCommand[];
  left: boolean;
  simulateCommand(cmd: VoxelNetworkCommand): void;
  simulateSnapshot(snapshot: VoxelWorldJSON): void;
}

function createMockRoom(clientId = "client-A"): MockRoom {
  const sentCommands: VoxelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  function emit(type: string, payload: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  const room: MockRoom = {
    id: "test-room",
    clientId,
    peers: new Map(),

    role: "default",

    rights: {},

    access: "write" as const,

    can: () => "write" as const,
    sentCommands,
    left: false,
    on: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener as (payload: unknown) => void);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener as (payload: unknown) => void);
    },
    join() {
      return void 0;
    },
    send(cmd) {
      sentCommands.push(cmd);
    },
    updatePresence() {
      return void 0;
    },
    leave() {
      room.left = true;
    },
    simulateCommand(cmd) {
      emit("message", { type: "command", data: cmd });
    },
    simulateSnapshot(snapshot) {
      emit("message", { type: "snapshot", data: snapshot });
    }
  };

  return room;
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
    const engine = makeEngine();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, engine });

    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    });

    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "voxel-set");
    assert.equal(room.sentCommands[0].clientId, "client-A");
  });

  it("stamps each command with clientId and a timestamp", () => {
    const engine = makeEngine();
    const room = createMockRoom("client-B");
    const before = Date.now();
    new VoxelSyncClient({ room, engine });

    engine.world.addLayer("Layer1");

    const cmd = room.sentCommands[0];
    assert.equal(cmd.clientId, "client-B");
    assert.ok(cmd.timestamp >= before);
    assert.ok(cmd.timestamp <= Date.now());
  });

  it("increments seq per outbound command", () => {
    const engine = makeEngine();
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    engine.world.addLayer("L1");
    engine.world.addLayer("L2");
    engine.world.addLayer("L3");

    assert.deepEqual(
      room.sentCommands.map((command) => command.seq),
      [1, 2, 3]
    );
  });

  it("leaves listeners registered before it untouched", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    engine.world.addLayer("L1");

    assert.equal(received.length, 1);
    assert.equal(room.sentCommands.length, 1);
  });
});

describe("VoxelSyncClient — remote commands", () => {
  it("applies commands from a different client to the engine", () => {
    const engine = makeEngine();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, engine });

    room.simulateCommand(voxelSetCmd({
      x: 5,
      z: 5,
      blockId: 2,
      clientId: "client-B"
    }));

    assert.equal(
      engine.world.getLayer("Ground")!.getVoxelAt({ x: 5, y: 0, z: 5 })?.blockId,
      2
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("notifies local listeners with a remote origin", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, engine });

    room.simulateCommand(voxelSetCmd({ clientId: "client-B" }));

    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["voxel-set", "remote"]]
    );
  });

  it("does not apply its own echoed command", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, engine });

    room.simulateCommand(voxelSetCmd({ clientId: "client-A" }));

    assert.equal(
      engine.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 }),
      undefined
    );
    assert.equal(received.length, 0);
  });

  it("ignores a world-replace command", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, engine });

    room.simulateCommand({
      ...kPeerHeader,
      action: "world-replace",
      data: makeEmptySnapshot()
    });

    assert.ok(engine.world.getLayer("Ground"));
    assert.equal(received.length, 0);
  });
});

describe("VoxelSyncClient — snapshot loading", () => {
  it("loads a snapshot into the engine", () => {
    const engine = makeEngine();
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    room.simulateSnapshot(snapshotWithTileset());

    assert.deepEqual(engine.tilesets.definitions().map(({ id }) => id), ["stone"]);
    assert.equal(engine.defaultTileSize, 16);
    assert.equal(engine.world.getLayer("Ground"), undefined);
    assert.equal(room.sentCommands.length, 0);
  });
});

describe("VoxelSyncClient — replaceWorld", () => {
  it("sends a stamped world-replace command carrying the data", () => {
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room, engine: makeEngine() });

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
  it("stops listening for room messages and leaves the room", () => {
    const engine = makeEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, engine });

    client.destroy();
    room.simulateSnapshot(snapshotWithTileset());

    assert.deepEqual(engine.tilesets.definitions(), []);
    assert.equal(room.left, true);
  });

  it("stops forwarding local commands and keeps other listeners", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, engine });

    client.destroy();
    engine.world.addLayer("L");

    assert.equal(room.sentCommands.length, 0);
    assert.equal(received.length, 1);
  });
});

describe("VoxelSyncClient — block commands", () => {
  it("publishes a local definition", () => {
    const engine = makeEngine();
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    engine.defineBlock(makeBlockDef(4, "slope"));

    assert.equal(room.sentCommands.length, 1);
    const [command] = room.sentCommands;
    assert.equal(
      command.action === "block-defined" ? command.block.shapeId : null,
      "slope"
    );
    assert.equal(command.clientId, "client-A");
  });

  it("publishes a local removal, and nothing for an unknown id", () => {
    const engine = makeEngine();
    engine.defineBlock(makeBlockDef(4, "cube"));
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    engine.removeBlock(99);
    assert.equal(room.sentCommands.length, 0);

    engine.removeBlock(4);
    const [command] = room.sentCommands;
    assert.equal(
      command.action === "block-removed" ? command.blockId : null,
      4
    );
  });

  it("publishes one command per block of a batch", () => {
    const engine = makeEngine();
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    engine.defineBlocks([
      makeBlockDef(4, "slope"),
      makeBlockDef(5, "cube")
    ]);

    assert.deepEqual(
      room.sentCommands.map((command) => command.action),
      ["block-defined", "block-defined"]
    );
  });

  it("registers a peer definition without re-publishing it", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    room.simulateCommand({
      ...kPeerHeader,
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope"))
    });

    assert.equal(engine.blockRegistry.get(4)?.shapeId, "slope");
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["block-defined", "remote"]]
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("stays quiet when a peer removal names an unknown block", () => {
    const engine = makeEngine();
    const received = record(engine);
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    room.simulateCommand({
      ...kPeerHeader,
      action: "block-removed",
      blockId: 99
    });

    assert.equal(received.length, 0);
  });

  it("ignores the echo of its own block command", () => {
    const engine = makeEngine();
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room, engine });

    room.simulateCommand({
      ...kPeerHeader,
      clientId: "client-A",
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope"))
    });

    assert.equal(engine.blockRegistry.has(4), false);
  });
});

describe("VoxelSyncClient — block reorder", () => {
  function makeEngineWithBlocks(): VoxelEngine {
    const engine = makeEngine();
    engine.defineBlocks([
      makeBlockDef(1, "cube"),
      makeBlockDef(2, "cube"),
      makeBlockDef(3, "cube")
    ]);

    return engine;
  }

  function ids(
    engine: VoxelEngine
  ): number[] {
    return [...engine.blockRegistry].map((block) => block.id);
  }

  it("publishes a local move", () => {
    const engine = makeEngineWithBlocks();
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    engine.moveBlock(3, 0);

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
    const engine = makeEngineWithBlocks();
    const room = createMockRoom();
    new VoxelSyncClient({ room, engine });

    room.simulateCommand({
      ...kPeerHeader,
      action: "block-moved",
      blockId: 1,
      toIndex: 2
    });

    assert.deepEqual(ids(engine), [2, 3, 1]);
    assert.equal(room.sentCommands.length, 0);
  });
});

describe("VoxelSyncClient — tilesets", () => {
  function makeClient() {
    const engine = makeEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room, engine });
    room.simulateSnapshot(snapshotWithTileset());
    const received = record(engine);

    return { engine, received, room, client };
  }

  it("applies a remote tileset command without echoing it", () => {
    const { engine, received, room } = makeClient();

    room.simulateCommand({
      ...kPeerHeader,
      action: "tileset-added",
      tileset: { id: "wood", src: "asset-wood", tileSize: 16 }
    });

    assert.deepEqual(engine.tilesets.definitions().map(({ id }) => id), ["stone", "wood"]);
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["tileset-added", "remote"]]
    );
    assert.equal(room.sentCommands.length, 0);
  });

  it("rescales the engine blocks on a remote resize without echoing them", () => {
    const { engine, room } = makeClient();
    engine.blockRegistry.register(makeBlockDef(1, "cube", {
      defaultTexture: { col: 1, row: 1, tilesetId: "stone" }
    }));

    room.simulateCommand({
      ...kPeerHeader,
      action: "tileset-resized",
      tilesetId: "stone",
      tileSize: 16
    });

    assert.deepEqual(engine.blockRegistry.get(1)?.defaultTexture, {
      col: 2,
      row: 2,
      tilesetId: "stone",
      size: 32
    });
    assert.equal(room.sentCommands.length, 0);
  });

  it("sends a local tileset change", () => {
    const { engine, received, room } = makeClient();

    assert.equal(engine.removeTileset("stone"), true);

    assert.deepEqual(engine.tilesets.definitions(), []);
    assert.deepEqual(
      received.map(({ command, origin }) => [command.action, origin]),
      [["tileset-removed", "local"]]
    );
    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "tileset-removed");
  });

  it("sends nothing for a local change that does not apply", () => {
    const { engine, room } = makeClient();

    assert.equal(engine.removeTileset("missing"), false);
    assert.equal(room.sentCommands.length, 0);
  });
});
