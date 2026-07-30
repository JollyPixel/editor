// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import type {
  PixelNetworkCommand,
  PixelBufferSnapshot,
  PixelServerMessage
} from "#src/network/types.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "#src/buffer/hooks.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockManager {
  onBufferUpdated: PixelBufferHookListener | undefined;
  applyRemoteCommand(event: PixelBufferHookEvent): void;
  loadSnapshot(size: { x: number; y: number; }, pixels: Uint8ClampedArray): void;
  triggerLocal(event: PixelBufferHookEvent): void;
  appliedCommands: PixelBufferHookEvent[];
  loadedSnapshots: {
    size: { x: number; y: number; };
    pixels: Uint8ClampedArray;
  }[];
}

function createMockManager(): MockManager {
  const appliedCommands: PixelBufferHookEvent[] = [];
  const loadedSnapshots: {
    size: { x: number; y: number; };
    pixels: Uint8ClampedArray;
  }[] = [];
  let listener: PixelBufferHookListener | undefined;

  const manager: MockManager = {
    get onBufferUpdated() {
      return listener;
    },
    set onBufferUpdated(fn: PixelBufferHookListener | undefined) {
      listener = fn;
    },
    applyRemoteCommand(event) {
      appliedCommands.push(event);
    },
    loadSnapshot(size, pixels) {
      loadedSnapshots.push({ size, pixels });
    },
    triggerLocal(event) {
      listener?.(event);
    },
    appliedCommands,
    loadedSnapshots
  };

  return manager;
}

// PixelSyncClient is typed against the concrete PixelArtCanvas, but only uses
// the structural subset MockManager implements (onBufferUpdated,
// applyRemoteCommand, loadSnapshot). This single helper documents that seam so
// the individual call sites stay cast-free.
function asHost(
  manager: MockManager
): PixelArtCanvas {
  return manager as unknown as PixelArtCanvas;
}

interface MockRoom extends network.Room<PixelNetworkCommand, PixelServerMessage> {
  sentCommands: PixelNetworkCommand[];
  simulateCommand(cmd: PixelNetworkCommand): void;
  simulateSnapshot(snapshot: PixelBufferSnapshot): void;
}

function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const sentCommands: PixelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: any) => void>>();

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
    on: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    join() {
      // Unused by PixelSyncClient.
    },
    send(cmd) {
      sentCommands.push(cmd);
    },
    updatePresence() {
      // Unused by PixelSyncClient.
    },
    leave() {
      // Unused by PixelSyncClient.
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

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("PixelSyncClient — attach", () => {
  test("sets manager.onBufferUpdated", () => {
    const manager = createMockManager();
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });

    assert.strictEqual(manager.onBufferUpdated, undefined);
    client.attach(asHost(manager));
    assert.ok(manager.onBufferUpdated !== undefined);
  });

  test("throws when a canvas is already attached", () => {
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(createMockManager()));

    assert.throws(() => client.attach(asHost(createMockManager())));
  });
});

describe("PixelSyncClient — chaining onBufferUpdated", () => {
  test("attach preserves an existing local handler instead of replacing it", () => {
    const manager = createMockManager();
    const received: PixelBufferHookEvent[] = [];
    manager.onBufferUpdated = (event) => received.push(event);

    const room = createMockRoom("client-A");
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    manager.triggerLocal({
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(room.sentCommands.length, 1);
  });

  test("detach restores the handler that was present before attach", () => {
    const manager = createMockManager();
    const received: PixelBufferHookEvent[] = [];
    function original(event: PixelBufferHookEvent): void {
      received.push(event);
    }
    manager.onBufferUpdated = original;

    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));
    client.detach();

    assert.strictEqual(manager.onBufferUpdated, original);

    manager.triggerLocal({
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(room.sentCommands.length, 0);
  });

  test("detach without an attached manager is a no-op", () => {
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    assert.doesNotThrow(() => client.detach());
  });
});

// ---------------------------------------------------------------------------
// Local mutations forwarded to the room
// ---------------------------------------------------------------------------

describe("PixelSyncClient — local mutations forwarded to the room", () => {
  test("sends a command when an attached manager fires a stroke", () => {
    const manager = createMockManager();
    const room = createMockRoom("client-A");
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    manager.triggerLocal({
      action: "stroke",
      metadata: {
        color: { r: 0, g: 0, b: 0, a: 255 },
        positions: [
          { x: 0, y: 0 }
        ]
      }
    });

    assert.strictEqual(room.sentCommands.length, 1);
    const cmd = room.sentCommands[0];
    assert.strictEqual(cmd.action, "stroke");
    assert.strictEqual(cmd.clientId, "client-A");
  });

  test("stamps each command with an incrementing seq and a timestamp", () => {
    const manager = createMockManager();
    const room = createMockRoom("client-B");
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    const before = Date.now();
    manager.triggerLocal({
      action: "resized",
      metadata: {
        size: { x: 1, y: 1 }
      }
    });
    manager.triggerLocal({
      action: "resized",
      metadata: {
        size: { x: 2, y: 2 }
      }
    });

    assert.strictEqual(room.sentCommands[0].seq, 1);
    assert.strictEqual(room.sentCommands[1].seq, 2);
    assert.ok(room.sentCommands[0].timestamp >= before);
  });
});

// ---------------------------------------------------------------------------
// Remote commands
// ---------------------------------------------------------------------------

describe("PixelSyncClient — remote commands", () => {
  test("routes a mutation command to the attached manager", () => {
    const manager = createMockManager();
    const room = createMockRoom("client-A");
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    room.simulateCommand({
      action: "stroke",
      metadata: {
        color: { r: 1, g: 1, b: 1, a: 255 },
        positions: [{ x: 0, y: 0 }]
      },
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    });

    assert.strictEqual(manager.appliedCommands.length, 1);
  });

  test("ignores commands echoed back from the local client", () => {
    const manager = createMockManager();
    const room = createMockRoom("client-A");
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    room.simulateCommand({
      action: "stroke",
      metadata: {
        color: { r: 1, g: 1, b: 1, a: 255 },
        positions: [{ x: 0, y: 0 }]
      },
      clientId: "client-A",
      seq: 1,
      timestamp: Date.now()
    });

    assert.strictEqual(manager.appliedCommands.length, 0);
  });

  test("ignores commands when no manager is attached", () => {
    const room = createMockRoom("client-A");
    new PixelSyncClient({ room });

    assert.doesNotThrow(() => {
      room.simulateCommand({
        action: "stroke",
        metadata: {
          color: { r: 1, g: 1, b: 1, a: 255 },
          positions: [{ x: 0, y: 0 }]
        },
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

describe("PixelSyncClient — snapshot loading", () => {
  test("calls manager.loadSnapshot with decoded pixels when a snapshot arrives", () => {
    const manager = createMockManager();
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    const pixels = new Uint8ClampedArray([1, 2, 3, 255]);
    const base64 = Buffer.from(pixels).toString("base64");
    room.simulateSnapshot({
      size: { x: 1, y: 1 },
      pixels: base64,
      uvRegions: []
    });

    assert.strictEqual(manager.loadedSnapshots.length, 1);
    assert.deepStrictEqual(
      manager.loadedSnapshots[0].size,
      { x: 1, y: 1 }
    );
    assert.deepStrictEqual(
      Array.from(manager.loadedSnapshots[0].pixels),
      [1, 2, 3, 255]
    );
  });

  test("ignores a snapshot when no manager is attached", () => {
    const room = createMockRoom();
    new PixelSyncClient({ room });

    assert.doesNotThrow(() => {
      room.simulateSnapshot(
        { size: { x: 1, y: 1 }, pixels: "", uvRegions: [] }
      );
    });
  });
});

// ---------------------------------------------------------------------------
// ready
// ---------------------------------------------------------------------------

describe("PixelSyncClient — ready", () => {
  test("ready is false until the first snapshot, then dispatches a \"ready\" event", () => {
    const manager = createMockManager();
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    assert.strictEqual(client.ready, false);

    let fired = 0;
    client.on("ready", () => {
      fired++;
    });
    room.simulateSnapshot({ size: { x: 1, y: 1 }, pixels: "", uvRegions: [] });

    assert.strictEqual(client.ready, true);
    assert.strictEqual(fired, 1);
  });

  test("fires \"ready\" only once across multiple snapshots", () => {
    const manager = createMockManager();
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    let fired = 0;
    client.on("ready", () => {
      fired++;
    });
    room.simulateSnapshot({ size: { x: 1, y: 1 }, pixels: "", uvRegions: [] });
    room.simulateSnapshot({ size: { x: 1, y: 1 }, pixels: "", uvRegions: [] });

    assert.strictEqual(fired, 1);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("PixelSyncClient — destroy", () => {
  test("detaches the canvas and stops listening for room messages", () => {
    const manager = createMockManager();
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    client.destroy();

    assert.strictEqual(manager.onBufferUpdated, undefined);
    room.simulateSnapshot({ size: { x: 1, y: 1 }, pixels: "", uvRegions: [] });
    assert.strictEqual(manager.loadedSnapshots.length, 0);
  });

  test("stops forwarding local mutations after destroy", () => {
    const manager = createMockManager();
    const room = createMockRoom();
    const client = new PixelSyncClient({ room });
    client.attach(asHost(manager));

    client.destroy();
    manager.triggerLocal({
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    });

    assert.strictEqual(room.sentCommands.length, 0);
  });
});
