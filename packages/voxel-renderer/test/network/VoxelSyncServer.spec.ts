// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RoomHandle } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  VoxelSyncServer,
  type ClientHandle
} from "../../src/network/VoxelSyncServer.ts";
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import type { VoxelNetworkCommand } from "../../src/network/types.ts";
import type { VoxelWorldJSON } from "../../src/serialization/VoxelSerializer.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockClient extends ClientHandle {
  received: unknown[];
}

function createClient(id: string): MockClient {
  const received: unknown[] = [];

  return {
    id,
    received,
    send(data) {
      received.push(data);
    }
  };
}

/**
 * `receive()` no longer stashes a broadcast callback — the caller (normally
 * `ServerRoom`, via `onMessage`) hands one in per call. Tests that don't care
 * about broadcast delivery can pass this no-op.
 */
const noopRoom: RoomHandle = {
  broadcast: () => {
    // no observers
  }
};

/**
 * Connects a client and returns a RoomHandle that forwards broadcasts
 * straight to it — the single-client fake a unit test needs to observe
 * `receive()`'s broadcasts.
 */
function observe(
  server: VoxelSyncServer,
  client: MockClient
): RoomHandle {
  server.onClientConnect(client);

  return { broadcast: (payload) => client.send(payload) };
}

function voxelSetCmd(
  opts: {
    clientId?: string;
    seq?: number;
    timestamp?: number;
    x?: number;
    y?: number;
    z?: number;
    blockId?: number;
    layerName?: string;
  } = {}
): VoxelNetworkCommand {
  return {
    action: "voxel-set",
    layerName: opts.layerName ?? "Ground",
    metadata: {
      position: { x: opts.x ?? 0, y: opts.y ?? 0, z: opts.z ?? 0 },
      blockId: opts.blockId ?? 1,
      rotation: 0,
      flipX: false,
      flipZ: false,
      flipY: false
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}

// ---------------------------------------------------------------------------
// snapshot()
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// onClientConnect
//
// Peer-joined/peer-left notifications and client-list bookkeeping are now a
// Server concern (see @jolly-pixel/network's Server.spec.ts) —
// VoxelSyncServer no longer tracks its own client list.
// ---------------------------------------------------------------------------

describe("VoxelSyncServer — onClientConnect", () => {
  it("sends a snapshot to the newly connected client", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    server.onClientConnect(client);

    assert.equal(client.received.length, 1);
    const msg = client.received[0] as { type: string; data: VoxelWorldJSON; };
    assert.equal(msg.type, "snapshot");
    assert.equal(msg.data.version, 1);
  });
});

// ---------------------------------------------------------------------------
// receive()
// ---------------------------------------------------------------------------

describe("VoxelSyncServer — receive: apply + broadcast", () => {
  it("applies the command to the world", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ x: 2, y: 0, z: 3, blockId: 7 }), noopRoom);

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 2, y: 0, z: 3 });
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
    const msg = client.received[0] as { type: string; data: VoxelNetworkCommand; };
    assert.equal(msg.type, "command");
    assert.equal(msg.data.action, "voxel-set");
  });

  it("broadcasts structural commands (no key)", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    const cmd: VoxelNetworkCommand = {
      action: "added",
      layerName: "Deco",
      metadata: { options: {} },
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

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 1);
  });

  it("accepts a later timestamp (LWW wins)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "A" }), noopRoom);
    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "B" }), noopRoom);

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 2);
  });

  it("rejects an earlier timestamp (stale command)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "A" }), noopRoom);
    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "B" }), noopRoom);

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
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
    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
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

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 2);
  });

  it("does not conflict-check non-voxel commands", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    const cmd1: VoxelNetworkCommand = {
      action: "added",
      layerName: "Layer",
      metadata: { options: {} },
      clientId: "X",
      seq: 1,
      timestamp: 900
    };
    const cmd2: VoxelNetworkCommand = {
      action: "added",
      layerName: "Layer2",
      metadata: { options: {} },
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

describe("VoxelSyncServer — receive: invalid commands are dropped, not thrown", () => {
  it("does not throw when a command targets a layer the server doesn't know about", () => {
    const server = new VoxelSyncServer();
    // No "Ground" layer created — the server world is empty.

    assert.doesNotThrow(() => {
      server.receive(voxelSetCmd({ layerName: "Ground" }), noopRoom);
    });
  });

  it("does not broadcast a command that fails to apply", () => {
    const server = new VoxelSyncServer();

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(voxelSetCmd({ layerName: "Unknown" }), room);

    assert.equal(client.received.length, 0);
  });

  it("keeps the server usable for subsequent valid commands after dropping an invalid one", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ layerName: "Unknown" }), noopRoom);
    server.receive(voxelSetCmd({ layerName: "Ground", x: 1, y: 2, z: 3, blockId: 5 }), noopRoom);

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 1, y: 2, z: 3 });
    assert.ok(entry);
    assert.equal(entry.blockId, 5);
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
