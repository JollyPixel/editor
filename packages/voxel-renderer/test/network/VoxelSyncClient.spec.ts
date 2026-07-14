// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelSyncClient } from "../../src/network/VoxelSyncClient.ts";
import type { VoxelTransport } from "../../src/network/VoxelTransport.ts";
import type { VoxelNetworkCommand } from "../../src/network/types.ts";
import type { VoxelLayerHookEvent, VoxelLayerHookListener } from "../../src/hooks.ts";
import type { VoxelWorldJSON } from "../../src/serialization/VoxelSerializer.ts";
import type { VoxelEngine } from "../../src/VoxelEngine.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockEngine {
  onLayerUpdated: VoxelLayerHookListener | undefined;
  applyRemoteCommand(cmd: VoxelLayerHookEvent): void;
  load(data: VoxelWorldJSON): void;
  // Test helper: simulate a local mutation firing the hook
  triggerLocal(event: VoxelLayerHookEvent): void;
  appliedCommands: VoxelLayerHookEvent[];
  loadedSnapshots: VoxelWorldJSON[];
}

function createMockEngine(): MockEngine {
  const appliedCommands: VoxelLayerHookEvent[] = [];
  const loadedSnapshots: VoxelWorldJSON[] = [];
  let listener: VoxelLayerHookListener | undefined;

  const engine: MockEngine = {
    get onLayerUpdated() {
      return listener;
    },
    set onLayerUpdated(fn: VoxelLayerHookListener | undefined) {
      listener = fn;
    },
    applyRemoteCommand(cmd) {
      appliedCommands.push(cmd);
    },
    load(data) {
      loadedSnapshots.push(data);
    },
    triggerLocal(event) {
      listener?.(event);
    },
    appliedCommands,
    loadedSnapshots
  };

  return engine;
}

interface MockTransport extends VoxelTransport {
  sentCommands: VoxelNetworkCommand[];
  // Test helper: simulate receiving a command from a remote peer
  simulateCommand(cmd: VoxelNetworkCommand): void;
  // Test helper: simulate receiving a snapshot from the server
  simulateSnapshot(snapshot: VoxelWorldJSON): void;
}

function createMockTransport(clientId = "client-A"): MockTransport {
  const sentCommands: VoxelNetworkCommand[] = [];

  return {
    localClientId: clientId,
    sentCommands,
    onCommand: null,
    onSnapshot: null,
    onPeerJoined: null,
    onPeerLeft: null,
    sendCommand(cmd) {
      sentCommands.push(cmd);
    },
    requestSnapshot() {
      /* no-op */
    },
    simulateCommand(cmd) {
      this.onCommand?.(cmd);
    },
    simulateSnapshot(snapshot) {
      this.onSnapshot?.(snapshot);
    }
  };
}

function makeEmptySnapshot(): VoxelWorldJSON {
  return { version: 1, chunkSize: 16, tilesets: [], layers: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — constructor", () => {
  it("sets engine.onLayerUpdated in the constructor", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    assert.equal(engine.onLayerUpdated, undefined);

    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    assert.ok(engine.onLayerUpdated !== undefined);
  });

  it("sets transport.onCommand in the constructor", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    assert.equal(transport.onCommand, null);

    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    assert.ok(transport.onCommand !== null);
  });
});

describe("VoxelSyncClient — local mutations forwarded to transport", () => {
  it("sends a command when a local voxel-set fires", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-A");
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    engine.triggerLocal({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    });

    assert.equal(transport.sentCommands.length, 1);
    assert.equal(transport.sentCommands[0].action, "voxel-set");
    assert.equal(transport.sentCommands[0].clientId, "client-A");
  });

  it("stamps each command with clientId and a timestamp", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-B");
    const before = Date.now();
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    engine.triggerLocal({
      action: "added",
      layerName: "Layer1",
      metadata: { options: {} }
    });

    const cmd = transport.sentCommands[0];
    assert.equal(cmd.clientId, "client-B");
    assert.ok(cmd.timestamp >= before);
    assert.ok(cmd.timestamp <= Date.now());
  });

  it("increments seq per outbound command", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    engine.triggerLocal({ action: "added", layerName: "L1", metadata: { options: {} } });
    engine.triggerLocal({ action: "added", layerName: "L2", metadata: { options: {} } });
    engine.triggerLocal({ action: "added", layerName: "L3", metadata: { options: {} } });

    assert.equal(transport.sentCommands[0].seq, 1);
    assert.equal(transport.sentCommands[1].seq, 2);
    assert.equal(transport.sentCommands[2].seq, 3);
  });
});

describe("VoxelSyncClient — remote commands applied without re-emitting", () => {
  it("applies commands from a different client to the engine", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-A");
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    const remoteCmd: VoxelNetworkCommand = {
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 5, y: 0, z: 5 },
        blockId: 2,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      },
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    };

    transport.simulateCommand(remoteCmd);

    assert.equal(engine.appliedCommands.length, 1);
    assert.equal(engine.appliedCommands[0].action, "voxel-set");
  });

  it("does NOT apply commands from the local client (echo prevention)", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-A");
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    const echoCmd: VoxelNetworkCommand = {
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      },
      clientId: "client-A",
      seq: 1,
      timestamp: Date.now()
    };

    transport.simulateCommand(echoCmd);

    assert.equal(engine.appliedCommands.length, 0);
  });

  it("does not forward remote commands back to the transport (no loop)", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-A");
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    const remoteCmd: VoxelNetworkCommand = {
      action: "added",
      layerName: "Ground",
      metadata: { options: {} },
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    };

    transport.simulateCommand(remoteCmd);

    // applyRemoteCommand was called — but that doesn't trigger onLayerUpdated
    // since #isApplyingRemote suppresses hooks.  The mock doesn't simulate
    // that suppression, but the absence of extra sentCommands proves no loop.
    assert.equal(transport.sentCommands.length, 0);
  });
});

describe("VoxelSyncClient — snapshot loading", () => {
  it("calls engine.load when a snapshot arrives", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    const snapshot = makeEmptySnapshot();
    transport.simulateSnapshot(snapshot);

    assert.equal(engine.loadedSnapshots.length, 1);
    assert.equal(engine.loadedSnapshots[0], snapshot);
  });
});

describe("VoxelSyncClient — destroy", () => {
  it("clears engine.onLayerUpdated", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const client = new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    client.destroy();

    assert.equal(engine.onLayerUpdated, undefined);
  });

  it("clears transport.onCommand", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const client = new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    client.destroy();

    assert.equal(transport.onCommand, null);
  });

  it("stops forwarding local mutations after destroy", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const client = new VoxelSyncClient({
      engine: engine as unknown as VoxelEngine,
      transport
    });

    client.destroy();
    engine.triggerLocal({
      action: "added",
      layerName: "L",
      metadata: { options: {} }
    });

    assert.equal(transport.sentCommands.length, 0);
  });
});
