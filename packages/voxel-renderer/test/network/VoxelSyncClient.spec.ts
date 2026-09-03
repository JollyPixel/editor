// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { VoxelSyncClient } from "../../src/network/VoxelSyncClient.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "../../src/blocks/BlockDefinition.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "../../src/network/types.ts";
import type {
  VoxelBlockHookListener,
  VoxelLayerHookEvent,
  VoxelLayerHookListener
} from "../../src/hooks.ts";
import type { VoxelWorldJSON } from "../../src/serialization/types.ts";
import type { VoxelEngine } from "../../src/VoxelEngine.ts";
import { makeAddedCommand, voxelSetCmd } from "../helpers/networkCommands.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockEngine {
  onLayerUpdated: VoxelLayerHookListener | undefined;
  applyRemoteCommand(cmd: VoxelLayerHookEvent): void;
  load(data: VoxelWorldJSON): void;
  markAllChunksDirty(reason: string): void;
  blockRegistry: BlockRegistry;
  onBlockUpdated: VoxelBlockHookListener | undefined;
  defineBlock(def: BlockDefinition): void;
  defineBlocks(defs: Iterable<BlockDefinition>): void;
  removeBlock(blockId: number): boolean;
  // Test helper: simulate a local mutation firing the hook
  triggerLocal(event: VoxelLayerHookEvent): void;
  appliedCommands: VoxelLayerHookEvent[];
  loadedSnapshots: VoxelWorldJSON[];
  dirtyReasons: string[];
}

function createMockEngine(): MockEngine {
  const appliedCommands: VoxelLayerHookEvent[] = [];
  const loadedSnapshots: VoxelWorldJSON[] = [];
  const dirtyReasons: string[] = [];
  let listener: VoxelLayerHookListener | undefined;
  let blockListener: VoxelBlockHookListener | undefined;

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
    markAllChunksDirty(reason) {
      dirtyReasons.push(reason);
    },
    blockRegistry: new BlockRegistry(),
    get onBlockUpdated() {
      return blockListener;
    },
    set onBlockUpdated(fn: VoxelBlockHookListener | undefined) {
      blockListener = fn;
    },
    defineBlock(def) {
      engine.defineBlocks([def]);
    },
    defineBlocks(defs) {
      const resolved = [...defs].map(resolveBlockDefinition);
      if (resolved.length === 0) {
        return;
      }

      for (const block of resolved) {
        engine.blockRegistry.register(block);
      }
      dirtyReasons.push("block-defined");
      for (const block of resolved) {
        blockListener?.({ action: "block-defined", block });
      }
    },
    removeBlock(blockId) {
      if (!engine.blockRegistry.unregister(blockId)) {
        return false;
      }

      dirtyReasons.push("block-removed");
      blockListener?.({ action: "block-removed", blockId });

      return true;
    },
    triggerLocal(event) {
      listener?.(event);
    },
    appliedCommands,
    loadedSnapshots,
    dirtyReasons
  };

  return engine;
}

function asEngine(
  engine: MockEngine
): VoxelEngine {
  return engine as unknown as VoxelEngine;
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
      // Unused by VoxelSyncClient.
    },
    send(cmd) {
      sentCommands.push(cmd);
    },
    updatePresence() {
      // Unused by VoxelSyncClient.
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

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — attach", () => {
  it("sets engine.onLayerUpdated", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });

    assert.equal(engine.onLayerUpdated, undefined);
    client.attach(asEngine(engine));
    assert.ok(engine.onLayerUpdated !== undefined);
  });

  it("throws when an engine is already attached", () => {
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(createMockEngine()));

    assert.throws(() => client.attach(asEngine(createMockEngine())));
  });
});

describe("VoxelSyncClient — chaining onLayerUpdated", () => {
  it("attach preserves an existing local handler instead of replacing it", () => {
    const engine = createMockEngine();
    const received: VoxelLayerHookEvent[] = [];
    engine.onLayerUpdated = (event) => received.push(event);

    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.triggerLocal(makeAddedCommand("L1"));

    assert.equal(received.length, 1);
    assert.equal(room.sentCommands.length, 1);
  });

  it("detach restores the handler that was present before attach", () => {
    const engine = createMockEngine();
    const received: VoxelLayerHookEvent[] = [];
    function original(event: VoxelLayerHookEvent): void {
      received.push(event);
    }
    engine.onLayerUpdated = original;

    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));
    client.detach();

    assert.equal(engine.onLayerUpdated, original);

    engine.triggerLocal(makeAddedCommand("L1"));
    assert.equal(received.length, 1);
    assert.equal(room.sentCommands.length, 0);
  });

  it("detach without an attached engine is a no-op", () => {
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    assert.doesNotThrow(() => client.detach());
  });
});

// ---------------------------------------------------------------------------
// Local mutations forwarded to the room
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — local mutations forwarded to the room", () => {
  it("sends a command when an attached engine fires a voxel-set", () => {
    const engine = createMockEngine();
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

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

    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "voxel-set");
    assert.equal(room.sentCommands[0].clientId, "client-A");
  });

  it("stamps each command with clientId and a timestamp", () => {
    const engine = createMockEngine();
    const room = createMockRoom("client-B");
    const before = Date.now();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.triggerLocal(makeAddedCommand("Layer1"));

    const cmd = room.sentCommands[0];
    assert.equal(cmd.clientId, "client-B");
    assert.ok(cmd.timestamp >= before);
    assert.ok(cmd.timestamp <= Date.now());
  });

  it("increments seq per outbound command", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.triggerLocal(makeAddedCommand("L1"));
    engine.triggerLocal(makeAddedCommand("L2"));
    engine.triggerLocal(makeAddedCommand("L3"));

    assert.equal(room.sentCommands[0].seq, 1);
    assert.equal(room.sentCommands[1].seq, 2);
    assert.equal(room.sentCommands[2].seq, 3);
  });
});

// ---------------------------------------------------------------------------
// Remote commands
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — remote commands applied without re-emitting", () => {
  it("applies commands from a different client to the engine", () => {
    const engine = createMockEngine();
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    const remoteCmd: VoxelNetworkCommand = voxelSetCmd({
      x: 5,
      y: 0,
      z: 5,
      blockId: 2,
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    });

    room.simulateCommand(remoteCmd);

    assert.equal(engine.appliedCommands.length, 1);
    assert.equal(engine.appliedCommands[0].action, "voxel-set");
  });

  it("does NOT apply commands from the local client (echo prevention)", () => {
    const engine = createMockEngine();
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    const echoCmd: VoxelNetworkCommand = voxelSetCmd({
      clientId: "client-A",
      seq: 1,
      timestamp: Date.now()
    });

    room.simulateCommand(echoCmd);

    assert.equal(engine.appliedCommands.length, 0);
  });

  it("ignores a world-replace command (arrives as a snapshot instead, not a command)", () => {
    const engine = createMockEngine();
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    room.simulateCommand({
      action: "world-replace",
      data: makeEmptySnapshot(),
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    });

    assert.equal(engine.appliedCommands.length, 0);
  });

  it("ignores commands when no engine is attached", () => {
    const room = createMockRoom("client-A");
    new VoxelSyncClient({ room });

    assert.doesNotThrow(() => {
      room.simulateCommand({
        ...makeAddedCommand("Ground"),
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

describe("VoxelSyncClient — snapshot loading", () => {
  it("calls engine.load when a snapshot arrives", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    const snapshot = makeEmptySnapshot();
    room.simulateSnapshot(snapshot);

    assert.equal(engine.loadedSnapshots.length, 1);
    assert.equal(engine.loadedSnapshots[0], snapshot);
  });

  it("ignores a snapshot when no engine is attached", () => {
    const room = createMockRoom();
    new VoxelSyncClient({ room });

    assert.doesNotThrow(() => {
      room.simulateSnapshot(makeEmptySnapshot());
    });
  });
});

// ---------------------------------------------------------------------------
// replaceWorld
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — replaceWorld", () => {
  it("sends a stamped world-replace command carrying the data", () => {
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });

    const data = makeEmptySnapshot();
    client.replaceWorld(data);

    assert.equal(room.sentCommands.length, 1);
    const cmd = room.sentCommands[0];
    assert.equal(cmd.action, "world-replace");
    assert.equal(cmd.clientId, "client-A");
    assert.ok(cmd.seq >= 1);
    assert.ok("data" in cmd && cmd.data === data);
  });

  it("does not require an attached engine", () => {
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });

    assert.doesNotThrow(() => client.replaceWorld(makeEmptySnapshot()));
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — destroy", () => {
  it("detaches the engine, stops listening for room messages and leaves the room", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    client.destroy();

    assert.equal(engine.onLayerUpdated, undefined);
    room.simulateSnapshot(makeEmptySnapshot());
    assert.equal(engine.loadedSnapshots.length, 0);
    assert.equal(room.left, true);
  });

  it("stops forwarding local mutations after destroy", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    client.destroy();
    engine.triggerLocal(makeAddedCommand("L"));

    assert.equal(room.sentCommands.length, 0);
  });
});

// ---------------------------------------------------------------------------
// block commands
// ---------------------------------------------------------------------------

describe("VoxelSyncClient — block commands", () => {
  it("publishes a local definition without an explicit send call", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.defineBlock(makeBlockDef(4, "slope"));

    assert.equal(room.sentCommands.length, 1);
    const [command] = room.sentCommands;
    assert.equal(command.action, "block-defined");
    assert.equal(
      command.action === "block-defined" ? command.block.shapeId : null,
      "slope"
    );
    assert.equal(command.clientId, "client-A");
  });

  it("publishes a local removal, and nothing for an unknown id", () => {
    const engine = createMockEngine();
    engine.blockRegistry.register(makeBlockDef(4, "cube"));
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.removeBlock(99);
    assert.equal(room.sentCommands.length, 0);

    engine.removeBlock(4);
    const [command] = room.sentCommands;
    assert.equal(command.action, "block-removed");
    assert.equal(
      command.action === "block-removed" ? command.blockId : null,
      4
    );
  });

  it("publishes one command per block of a batch", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.defineBlocks([
      makeBlockDef(4, "slope"),
      makeBlockDef(5, "cube")
    ]);

    assert.deepEqual(
      room.sentCommands.map((command) => command.action),
      ["block-defined", "block-defined"]
    );
  });

  it("keeps the handler an engine already carries", () => {
    const engine = createMockEngine();
    const seen: string[] = [];
    engine.onBlockUpdated = (event) => seen.push(event.action);

    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    engine.defineBlock(makeBlockDef(4, "slope"));

    assert.deepEqual(seen, ["block-defined"]);
    assert.equal(room.sentCommands.length, 1);
  });

  it("restores the previous handler on detach", () => {
    const engine = createMockEngine();
    function previous(): void {
      return void 0;
    }

    engine.onBlockUpdated = previous;

    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));
    client.detach();

    assert.equal(engine.onBlockUpdated, previous);
  });

  it("registers a peer definition, invalidates the meshes and notifies", () => {
    const engine = createMockEngine();
    const seen: string[] = [];
    engine.onBlockUpdated = (event) => seen.push(event.action);

    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    room.simulateCommand({
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope")),
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.equal(engine.blockRegistry.get(4)?.shapeId, "slope");
    assert.deepEqual(engine.dirtyReasons, ["block-defined"]);
    assert.deepEqual(seen, ["block-defined"]);
    assert.equal(engine.appliedCommands.length, 0);
  });

  it("never re-publishes a peer block command", () => {
    const engine = createMockEngine();
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    room.simulateCommand({
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope")),
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.equal(room.sentCommands.length, 0);
  });

  it("unregisters a peer removal", () => {
    const engine = createMockEngine();
    engine.blockRegistry.register(makeBlockDef(4, "cube"));
    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    room.simulateCommand({
      action: "block-removed",
      blockId: 4,
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.equal(engine.blockRegistry.has(4), false);
    assert.equal(room.sentCommands.length, 0);
  });

  it("stays quiet when a removal names an unknown block", () => {
    const engine = createMockEngine();
    let notified = 0;
    engine.onBlockUpdated = () => notified++;

    const room = createMockRoom();
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    room.simulateCommand({
      action: "block-removed",
      blockId: 99,
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.deepEqual(engine.dirtyReasons, []);
    assert.equal(notified, 0);
  });

  it("ignores the echo of its own block command", () => {
    const engine = createMockEngine();
    const room = createMockRoom("client-A");
    const client = new VoxelSyncClient({ room });
    client.attach(asEngine(engine));

    room.simulateCommand({
      action: "block-defined",
      block: resolveBlockDefinition(makeBlockDef(4, "slope")),
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    });

    assert.equal(engine.blockRegistry.has(4), false);
  });
});
