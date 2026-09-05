// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RoomContext, RoomEventStoreHandle } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  type ClientHandle,
  type VoxelNetworkCommand,
  type VoxelServerMessage,
  VoxelSyncServer
} from "../../src/network/index.ts";
import { VoxelWorld } from "../../src/world/index.ts";
import {
  blockDefinedCmd,
  makeAddedCommand,
  voxelSetCmd,
  worldReplaceCmd
} from "../helpers/networkCommands.ts";
import { AIR_BLOCK_ID } from "../../src/blocks/index.ts";
import { InvalidVoxelDocumentError } from "../../src/serialization/index.ts";

interface MockClient extends ClientHandle {
  received: VoxelServerMessage[];
}

function createClient(id: string): MockClient {
  const received: VoxelServerMessage[] = [];

  return {
    id,
    received,
    send(data) {
      received.push(data as VoxelServerMessage);
    }
  };
}

// receive() never touches eventStore, so every RoomContext in this file shares one unused stub.
const unusedEventStore: RoomEventStoreHandle = {
  append: () => Promise.resolve(true),
  list: () => Promise.resolve([])
};

/**
 * A RoomContext delivering every broadcast to `deliver`, which defaults to
 * dropping them for the tests that only care about the server's own state.
 */
function roomContext(
  deliver: (payload: unknown) => void = () => void 0
): RoomContext {
  return {
    room: {
      broadcast: deliver,
      sendTo: (_clientId, payload) => deliver(payload)
    },
    eventStore: unusedEventStore
  };
}

const noopRoom = roomContext();

/**
 * Connects a client and returns a RoomContext that forwards broadcasts
 * straight to it — the single-client fake a unit test needs to observe
 * `receive()`'s broadcasts.
 */
function observe(
  server: VoxelSyncServer,
  client: MockClient
): RoomContext {
  server.onClientConnect(client);

  return roomContext((payload) => client.send(payload));
}

describe("VoxelSyncServer — snapshot", () => {
  it("returns a valid VoxelWorldJSON with version 1", () => {
    const server = new VoxelSyncServer();
    const snap = server.snapshot();
    assert.equal(snap.version, 1);
  });

  it("reflects layers that were applied", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");
    const snap = server.snapshot();
    assert.equal(snap.layers.length, 1);
    assert.equal(snap.layers[0].name, "Ground");
  });

  it("tilesets array is empty (headless server)", () => {
    const server = new VoxelSyncServer();
    const snap = server.snapshot();
    assert.deepEqual(snap.tilesets, []);
  });
});

describe("VoxelSyncServer — onClientConnect", () => {
  it("sends a snapshot to the newly connected client", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    server.onClientConnect(client);

    assert.equal(client.received.length, 1);
    const msg = client.received[0];
    assert.equal(msg.type, "snapshot");
    assert.equal(msg.data.version, 1);
  });
});

describe("VoxelSyncServer — receive: apply + broadcast", () => {
  it("applies the command to the world", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ x: 2, y: 0, z: 3, blockId: 7 }), noopRoom);

    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 2, y: 0, z: 3 });
    assert.ok(entry);
    assert.equal(entry.blockId, 7);
  });

  it("broadcasts the command to observing clients", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(voxelSetCmd(), room);

    assert.equal(client.received.length, 1);
    const msg = client.received[0];
    assert.equal(msg.type, "command");
    assert.equal(msg.data.action, "voxel-set");
  });

  it("broadcasts structural commands (no key)", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    const cmd: VoxelNetworkCommand = {
      ...makeAddedCommand("Deco"),
      clientId: "client-X",
      seq: 1,
      timestamp: 1000
    };

    server.receive(cmd, room);

    assert.equal(client.received.length, 1);
    assert.ok(server.world.getLayer("Deco"));
  });
});

describe("VoxelSyncServer — receive: LWW conflict resolution", () => {
  it("accepts a command when no prior command exists at that position", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1 }), noopRoom);

    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 1);
  });

  it("accepts a later timestamp (LWW wins)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "A" }), noopRoom);
    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "B" }), noopRoom);

    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 2);
  });

  it("rejects an earlier timestamp (stale command)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "A" }), noopRoom);
    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "B" }), noopRoom);

    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    // stale command with blockId 1 was rejected — blockId 2 should remain
    assert.equal(entry.blockId, 2);
  });

  it("rejects a stale command from a different client and does NOT broadcast it", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "client-A" }), room);
    client.received.length = 0;

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "client-B" }), room);

    // Rejected command — no broadcast
    assert.equal(client.received.length, 0);
  });

  it("accepts an older-timestamped command from the SAME client (undo/redo replay ordering) and broadcasts it", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "client-A" }), room);
    client.received.length = 0;

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "client-A" }), room);

    assert.equal(client.received.length, 1);
    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 1);
  });

  it("resolves tie by lexicographic clientId", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const ts = 1000;
    // "client-B" > "client-A" lexicographically
    server.receive(voxelSetCmd({ timestamp: ts, x: 0, y: 0, z: 0, blockId: 1, clientId: "client-A" }), noopRoom);
    server.receive(voxelSetCmd({ timestamp: ts, x: 0, y: 0, z: 0, blockId: 2, clientId: "client-B" }), noopRoom);

    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 2);
  });

  it("does not conflict-check non-voxel commands", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    const cmd1: VoxelNetworkCommand = {
      ...makeAddedCommand("Layer"),
      clientId: "X",
      seq: 1,
      timestamp: 900
    };
    const cmd2: VoxelNetworkCommand = {
      ...makeAddedCommand("Layer2"),
      clientId: "Y",
      seq: 1,
      timestamp: 100
    };

    server.receive(cmd1, room);
    server.receive(cmd2, room);

    // Both accepted, both broadcast
    assert.equal(client.received.length, 2);
  });
});

describe("VoxelSyncServer — receive: unknown-layer mutations are dropped", () => {
  it("does not throw when a command targets a layer the server doesn't know about", () => {
    const server = new VoxelSyncServer();
    // No "Ground" layer created — the server world is empty.

    assert.doesNotThrow(() => {
      server.receive(voxelSetCmd({ layerName: "Ground" }), noopRoom);
    });
  });

  it("does not broadcast a command that targets an unknown layer", () => {
    const server = new VoxelSyncServer();

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(voxelSetCmd({ layerName: "Unknown" }), room);

    assert.equal(client.received.length, 0);
  });

  it("keeps the server usable for subsequent valid commands after dropping one", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ layerName: "Unknown" }), noopRoom);
    server.receive(voxelSetCmd({ layerName: "Ground", x: 1, y: 2, z: 3, blockId: 5 }), noopRoom);

    const layer = server.world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 1, y: 2, z: 3 });
    assert.ok(entry);
    assert.equal(entry.blockId, 5);
  });
});

describe("VoxelSyncServer — receive: invalid payloads throw", () => {
  it("throws on a world-replace whose chunkSize does not match the world", () => {
    const server = new VoxelSyncServer({ chunkSize: 16 });

    assert.throws(
      () => server.receive(worldReplaceCmd({ chunkSize: 32 }), noopRoom),
      InvalidVoxelDocumentError
    );
  });

  it("does not broadcast a world-replace it rejected", () => {
    const server = new VoxelSyncServer({ chunkSize: 16 });

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    assert.throws(
      () => server.receive(worldReplaceCmd({ chunkSize: 32 }), room)
    );
    assert.equal(client.received.length, 0);
  });

  it("throws on a block definition using the reserved air id", () => {
    const server = new VoxelSyncServer();

    assert.throws(
      () => server.receive(blockDefinedCmd({ id: AIR_BLOCK_ID }), noopRoom),
      /reserved for air/
    );
    assert.equal(server.blocks.has(AIR_BLOCK_ID), false);
  });

  it("does not broadcast a block command it rejected", () => {
    const server = new VoxelSyncServer();

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    assert.throws(
      () => server.receive(blockDefinedCmd({ id: AIR_BLOCK_ID }), room)
    );
    assert.equal(client.received.length, 0);
  });

  it("stays usable once an invalid payload has thrown", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    assert.throws(
      () => server.receive(blockDefinedCmd({ id: AIR_BLOCK_ID }), noopRoom)
    );
    server.receive(
      voxelSetCmd({ layerName: "Ground", x: 1, y: 2, z: 3, blockId: 5 }),
      noopRoom
    );

    const entry = server.world
      .getLayer("Ground")
      ?.getVoxelAt({ x: 1, y: 2, z: 3 });
    assert.equal(entry?.blockId, 5);
  });
});

describe("VoxelSyncServer — rights", () => {
  it("exposes a stable name shared by every instance, for rights-table namespacing", () => {
    assert.equal(new VoxelSyncServer({ id: "voxel-map:world-1" }).name, "voxel.renderer");
    assert.equal(new VoxelSyncServer({ id: "voxel-map:world-2" }).name, "voxel.renderer");
  });

  it("exposes its full action vocabulary via events", () => {
    const server = new VoxelSyncServer();

    assert.ok(server.events.includes("voxel-set"));
    assert.ok(server.events.includes("object-added"));
    assert.ok(server.events.includes("block-defined"));
    assert.ok(server.events.includes("block-removed"));
    assert.equal(server.events.length, 19);
  });

  it("getEventName() reads the command's action", () => {
    const server = new VoxelSyncServer();

    assert.equal(server.getEventName(voxelSetCmd()), "voxel-set");
  });

  it("getEventName() returns \"unknown\" for a payload that isn't a VoxelNetworkCommand", () => {
    const server = new VoxelSyncServer();

    assert.equal(server.getEventName({ not: "a command" }), "unknown");
  });
});

describe("VoxelSyncServer — receive: world-replace", () => {
  it("replaces the world's layers entirely", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Stale");

    server.receive({
      action: "world-replace",
      data: { version: 1, chunkSize: 16, tilesets: [], layers: [
        { id: "layer_1", name: "Fresh", order: 0, visible: true, opacity: 1, voxels: {} }
      ] },
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }, noopRoom);

    const layers = server.world.getLayers();
    assert.equal(layers.length, 1);
    assert.equal(layers[0].name, "Fresh");
    assert.equal(server.world.getLayer("Stale"), undefined);
  });

  it("broadcasts a fresh snapshot (not a command) to observing clients", () => {
    const server = new VoxelSyncServer();

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive({
      action: "world-replace",
      data: { version: 1, chunkSize: 16, tilesets: [], layers: [] },
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }, room);

    assert.equal(client.received.length, 1);
    const msg = client.received[0];
    assert.equal(msg.type, "snapshot");
    assert.equal(msg.data.version, 1);
  });

  it("is accepted regardless of prior LWW-tracked state (no conflict check)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2 }), noopRoom);

    assert.doesNotThrow(() => {
      server.receive({
        action: "world-replace",
        data: { version: 1, chunkSize: 16, tilesets: [], layers: [] },
        clientId: "client-B",
        seq: 1,
        timestamp: 500
      }, noopRoom);
    });

    assert.equal(server.world.getLayers().length, 0);
  });
});

describe("VoxelSyncServer — custom world / id", () => {
  it("accepts an existing VoxelWorld in options", () => {
    const world = new VoxelWorld(8);
    world.addLayer("PreExisting");

    const server = new VoxelSyncServer({ world });
    assert.equal(server.world, world);

    const snap = server.snapshot();
    assert.equal(snap.layers.length, 1);
    assert.equal(snap.layers[0].name, "PreExisting");
  });

  it("defaults to the \"voxel-map\" id, overridable per instance", () => {
    assert.equal(new VoxelSyncServer().id, "voxel-map");
    assert.equal(
      new VoxelSyncServer({ id: "voxel-map:world-2" }).id,
      "voxel-map:world-2"
    );
  });
});

describe("VoxelSyncServer — block commands", () => {
  it("registers a definition and carries it in the snapshot", () => {
    const server = new VoxelSyncServer();

    server.receive(
      blockDefinedCmd({
        id: 3,
        shapeId: "slope"
      }),
      noopRoom
    );

    assert.equal(server.blocks.get(3)?.shapeId, "slope");
    assert.deepEqual(
      server.snapshot().blocks?.map((block) => block.id),
      [3]
    );
  });

  it("broadcasts the command it accepted", () => {
    const server = new VoxelSyncServer();
    const client = createClient("client-B");
    const context = observe(server, client);
    client.received.length = 0;

    server.receive(blockDefinedCmd({ id: 3 }), context);

    assert.equal(client.received.length, 1);
    assert.equal(client.received[0].type, "command");
  });

  it("drops an older edit of the same block", () => {
    const server = new VoxelSyncServer();

    server.receive(
      blockDefinedCmd({
        id: 3,
        shapeId: "slope",
        clientId: "late",
        timestamp: 2000
      }),
      noopRoom
    );
    server.receive(
      blockDefinedCmd({
        id: 3,
        shapeId: "cube",
        clientId: "early",
        timestamp: 1000
      }),
      noopRoom
    );

    assert.equal(server.blocks.get(3)?.shapeId, "slope");
  });

  it("removes a definition on block-removed", () => {
    const server = new VoxelSyncServer();
    server.receive(blockDefinedCmd({ id: 3 }), noopRoom);

    server.receive(
      {
        action: "block-removed",
        blockId: 3,
        clientId: "client-A",
        seq: 2,
        timestamp: 2000
      },
      noopRoom
    );

    assert.equal(server.blocks.has(3), false);
  });

  it("a world-replace replaces the block table", () => {
    const server = new VoxelSyncServer();
    server.receive(blockDefinedCmd({ id: 3 }), noopRoom);

    server.receive(
      {
        action: "world-replace",
        data: {
          version: 1,
          chunkSize: 16,
          tilesets: [],
          blocks: [],
          layers: []
        },
        clientId: "client-A",
        seq: 2,
        timestamp: 2000
      },
      noopRoom
    );

    assert.equal(server.blocks.has(3), false);
  });
});
