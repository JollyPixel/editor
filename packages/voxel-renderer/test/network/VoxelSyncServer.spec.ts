// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

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
// connect()
// ---------------------------------------------------------------------------

describe("VoxelSyncServer — connect", () => {
  it("sends a snapshot to the newly connected client", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    server.connect(client);

    assert.equal(client.received.length, 1);
    const snap = client.received[0] as VoxelWorldJSON;
    assert.equal(snap.version, 1);
  });

  it("notifies existing peers when a new client joins", () => {
    const server = new VoxelSyncServer();
    const clientA = createClient("A");
    const clientB = createClient("B");

    server.connect(clientA);
    // A: 1 snapshot
    assert.equal(clientA.received.length, 1);

    server.connect(clientB);
    // B: 1 snapshot
    assert.equal(clientB.received.length, 1);
    // A notified about B
    assert.equal(clientA.received.length, 2);
    const notification = clientA.received[1] as { type: string; peerId: string; };
    assert.equal(notification.type, "peer-joined");
    assert.equal(notification.peerId, "B");
  });

  it("does NOT notify the joining client about itself", () => {
    const server = new VoxelSyncServer();
    const client = createClient("A");
    server.connect(client);
    // Only the snapshot, no self-notification
    assert.equal(client.received.length, 1);
  });
});

// ---------------------------------------------------------------------------
// disconnect()
// ---------------------------------------------------------------------------

describe("VoxelSyncServer — disconnect", () => {
  it("notifies remaining peers when a client leaves", () => {
    const server = new VoxelSyncServer();
    const clientA = createClient("A");
    const clientB = createClient("B");

    server.connect(clientA);
    server.connect(clientB);

    // Clear received so far
    clientA.received.length = 0;
    clientB.received.length = 0;

    server.disconnect("B");

    // A is notified
    assert.equal(clientA.received.length, 1);
    const msg = clientA.received[0] as { type: string; peerId: string; };
    assert.equal(msg.type, "peer-left");
    assert.equal(msg.peerId, "B");

    // B no longer receives anything
    assert.equal(clientB.received.length, 0);
  });
});

// ---------------------------------------------------------------------------
// receive()
// ---------------------------------------------------------------------------

describe("VoxelSyncServer — receive: apply + broadcast", () => {
  it("applies the command to the world", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ x: 2, y: 0, z: 3, blockId: 7 }));

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 2, y: 0, z: 3 });
    assert.ok(entry);
    assert.equal(entry.blockId, 7);
  });

  it("broadcasts the command to all connected clients", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const clientA = createClient("A");
    const clientB = createClient("B");
    server.connect(clientA);
    server.connect(clientB);
    clientA.received.length = 0;
    clientB.received.length = 0;

    server.receive(voxelSetCmd());

    assert.equal(clientA.received.length, 1);
    assert.equal(clientB.received.length, 1);
    const msg = clientA.received[0] as VoxelNetworkCommand;
    assert.equal(msg.action, "voxel-set");
  });

  it("broadcasts structural commands (no key) to all clients", () => {
    const server = new VoxelSyncServer();
    const clientA = createClient("A");
    server.connect(clientA);
    clientA.received.length = 0;

    const cmd: VoxelNetworkCommand = {
      action: "added",
      layerName: "Deco",
      metadata: { options: {} },
      clientId: "client-X",
      seq: 1,
      timestamp: 1000
    };

    server.receive(cmd);

    assert.equal(clientA.received.length, 1);
    assert.ok(server.world.getLayer("Deco"));
  });
});

describe("VoxelSyncServer — receive: LWW conflict resolution", () => {
  it("accepts a command when no prior command exists at that position", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1 }));

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 1);
  });

  it("accepts a later timestamp (LWW wins)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "A" }));
    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "B" }));

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 2);
  });

  it("rejects an earlier timestamp (stale command)", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2, clientId: "A" }));
    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1, clientId: "B" }));

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    // stale command with blockId 1 was rejected — blockId 2 should remain
    assert.equal(entry.blockId, 2);
  });

  it("rejects a stale command and does NOT broadcast it", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const clientA = createClient("A");
    server.connect(clientA);
    clientA.received.length = 0;

    server.receive(voxelSetCmd({ timestamp: 900, x: 0, y: 0, z: 0, blockId: 2 }));
    clientA.received.length = 0;

    server.receive(voxelSetCmd({ timestamp: 500, x: 0, y: 0, z: 0, blockId: 1 }));

    // Rejected command — no broadcast
    assert.equal(clientA.received.length, 0);
  });

  it("resolves tie by lexicographic clientId", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const ts = 1000;
    // "client-B" > "client-A" lexicographically
    server.receive(voxelSetCmd({ timestamp: ts, x: 0, y: 0, z: 0, blockId: 1, clientId: "client-A" }));
    server.receive(voxelSetCmd({ timestamp: ts, x: 0, y: 0, z: 0, blockId: 2, clientId: "client-B" }));

    const entry = server.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 2);
  });

  it("does not conflict-check non-voxel commands", () => {
    const server = new VoxelSyncServer();
    const clientA = createClient("A");
    server.connect(clientA);
    clientA.received.length = 0;

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

    server.receive(cmd1);
    server.receive(cmd2);

    // Both accepted, both broadcast
    assert.equal(clientA.received.length, 2);
  });
});

describe("VoxelSyncServer — multiple clients receive broadcasts", () => {
  it("all connected clients receive the command", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const clients = ["A", "B", "C"].map(createClient);
    for (const c of clients) {
      server.connect(c);
    }
    // Clear all snapshot + peer-joined notifications accumulated during connect
    for (const c of clients) {
      c.received.length = 0;
    }

    server.receive(voxelSetCmd());

    for (const c of clients) {
      assert.equal(c.received.length, 1, `client ${c.id} should receive the broadcast`);
    }
  });

  it("disconnected client does not receive subsequent broadcasts", () => {
    const server = new VoxelSyncServer();
    server.world.addLayer("Ground");

    const clientA = createClient("A");
    const clientB = createClient("B");
    server.connect(clientA);
    server.connect(clientB);

    server.disconnect("B");
    clientA.received.length = 0;
    clientB.received.length = 0;

    server.receive(voxelSetCmd());

    assert.equal(clientA.received.length, 1);
    assert.equal(clientB.received.length, 0);
  });
});

describe("VoxelSyncServer — custom world", () => {
  it("accepts an existing VoxelWorld in options", () => {
    const world = new VoxelWorld(8);
    world.addLayer("PreExisting");

    const server = new VoxelSyncServer({ world });
    assert.equal(server.world, world);

    const snap = server.snapshot();
    assert.equal(snap.layers.length, 1);
    assert.equal(snap.layers[0].name, "PreExisting");
  });
});
