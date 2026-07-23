// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelSyncSession } from "../../src/network/VoxelSyncSession.ts";
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

function asEngine(
  engine: MockEngine
): VoxelEngine {
  return engine as unknown as VoxelEngine;
}

interface MockTransport extends VoxelTransport {
  sentCommands: VoxelNetworkCommand[];
  simulateCommand(cmd: VoxelNetworkCommand): void;
  simulateSnapshot(snapshot: VoxelWorldJSON): void;
}

function createMockTransport(clientId = "client-A"): MockTransport {
  const sentCommands: VoxelNetworkCommand[] = [];

  return {
    localClientId: clientId,
    sentCommands,
    onMessage: null,
    onPeerJoined: null,
    onPeerLeft: null,
    send(cmd) {
      sentCommands.push(cmd);
    },
    simulateCommand(cmd) {
      this.onMessage?.({ type: "command", data: cmd });
    },
    simulateSnapshot(snapshot) {
      this.onMessage?.({ type: "snapshot", data: snapshot });
    }
  };
}

function makeEmptySnapshot(): VoxelWorldJSON {
  return { version: 1, chunkSize: 16, tilesets: [], layers: [] };
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("VoxelSyncSession — attach", () => {
  it("sets engine.onLayerUpdated", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });

    assert.equal(engine.onLayerUpdated, undefined);
    session.attach(asEngine(engine));
    assert.ok(engine.onLayerUpdated !== undefined);
  });

  it("throws when an engine is already attached", () => {
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(createMockEngine()));

    assert.throws(() => session.attach(asEngine(createMockEngine())));
  });
});

describe("VoxelSyncSession — chaining onLayerUpdated", () => {
  it("attach preserves an existing local handler instead of replacing it", () => {
    const engine = createMockEngine();
    const received: VoxelLayerHookEvent[] = [];
    engine.onLayerUpdated = (event) => received.push(event);

    const transport = createMockTransport("client-A");
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

    engine.triggerLocal({ action: "added", layerName: "L1", metadata: { options: {} } });

    assert.equal(received.length, 1);
    assert.equal(transport.sentCommands.length, 1);
  });

  it("detach restores the handler that was present before attach", () => {
    const engine = createMockEngine();
    const received: VoxelLayerHookEvent[] = [];
    function original(event: VoxelLayerHookEvent): void {
      received.push(event);
    }
    engine.onLayerUpdated = original;

    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));
    session.detach();

    assert.equal(engine.onLayerUpdated, original);

    engine.triggerLocal({ action: "added", layerName: "L1", metadata: { options: {} } });
    assert.equal(received.length, 1);
    assert.equal(transport.sentCommands.length, 0);
  });

  it("detach without an attached engine is a no-op", () => {
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    assert.doesNotThrow(() => session.detach());
  });
});

// ---------------------------------------------------------------------------
// Local mutations forwarded to transport
// ---------------------------------------------------------------------------

describe("VoxelSyncSession — local mutations forwarded to transport", () => {
  it("sends a command when an attached engine fires a voxel-set", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-A");
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

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
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

    engine.triggerLocal({ action: "added", layerName: "Layer1", metadata: { options: {} } });

    const cmd = transport.sentCommands[0];
    assert.equal(cmd.clientId, "client-B");
    assert.ok(cmd.timestamp >= before);
    assert.ok(cmd.timestamp <= Date.now());
  });

  it("increments seq per outbound command", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

    engine.triggerLocal({ action: "added", layerName: "L1", metadata: { options: {} } });
    engine.triggerLocal({ action: "added", layerName: "L2", metadata: { options: {} } });
    engine.triggerLocal({ action: "added", layerName: "L3", metadata: { options: {} } });

    assert.equal(transport.sentCommands[0].seq, 1);
    assert.equal(transport.sentCommands[1].seq, 2);
    assert.equal(transport.sentCommands[2].seq, 3);
  });
});

// ---------------------------------------------------------------------------
// Remote commands
// ---------------------------------------------------------------------------

describe("VoxelSyncSession — remote commands applied without re-emitting", () => {
  it("applies commands from a different client to the engine", () => {
    const engine = createMockEngine();
    const transport = createMockTransport("client-A");
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

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
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

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

  it("ignores commands when no engine is attached", () => {
    const transport = createMockTransport("client-A");
    new VoxelSyncSession({ transport });

    assert.doesNotThrow(() => {
      transport.simulateCommand({
        action: "added",
        layerName: "Ground",
        metadata: { options: {} },
        clientId: "client-B",
        seq: 1,
        timestamp: Date.now()
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Snapshot loading
// ---------------------------------------------------------------------------

describe("VoxelSyncSession — snapshot loading", () => {
  it("calls engine.load when a snapshot arrives", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

    const snapshot = makeEmptySnapshot();
    transport.simulateSnapshot(snapshot);

    assert.equal(engine.loadedSnapshots.length, 1);
    assert.equal(engine.loadedSnapshots[0], snapshot);
  });

  it("ignores a snapshot when no engine is attached", () => {
    const transport = createMockTransport();
    new VoxelSyncSession({ transport });

    assert.doesNotThrow(() => {
      transport.simulateSnapshot(makeEmptySnapshot());
    });
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("VoxelSyncSession — destroy", () => {
  it("detaches the engine and clears transport callbacks", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

    session.destroy();

    assert.equal(engine.onLayerUpdated, undefined);
    assert.equal(transport.onMessage, null);
  });

  it("stops forwarding local mutations after destroy", () => {
    const engine = createMockEngine();
    const transport = createMockTransport();
    const session = new VoxelSyncSession({ transport });
    session.attach(asEngine(engine));

    session.destroy();
    engine.triggerLocal({ action: "added", layerName: "L", metadata: { options: {} } });

    assert.equal(transport.sentCommands.length, 0);
  });
});
