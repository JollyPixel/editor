// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelSyncSession } from "../../src/network/PixelSyncSession.ts";
import type { PixelTransport } from "../../src/network/PixelTransport.ts";
import type { PixelNetworkCommand, PixelBufferSnapshot } from "../../src/network/types.ts";
import type { PixelBufferHookEvent, PixelBufferHookListener } from "../../src/buffer/hooks.ts";
import type { PixelArtCanvas } from "../../src/PixelArtCanvas.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockManager {
  onBufferUpdated: PixelBufferHookListener | undefined;
  applyRemoteCommand(event: PixelBufferHookEvent): void;
  loadSnapshot(size: { x: number; y: number; }, pixels: Uint8ClampedArray): void;
  triggerLocal(event: PixelBufferHookEvent): void;
  appliedCommands: PixelBufferHookEvent[];
  loadedSnapshots: { size: { x: number; y: number; }; pixels: Uint8ClampedArray; }[];
}

function createMockManager(): MockManager {
  const appliedCommands: PixelBufferHookEvent[] = [];
  const loadedSnapshots: { size: { x: number; y: number; }; pixels: Uint8ClampedArray; }[] = [];
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

interface MockTransport extends PixelTransport {
  sentCommands: PixelNetworkCommand[];
  subscribedBuffers: string[];
  unsubscribedBuffers: string[];
  simulateCommand(cmd: PixelNetworkCommand): void;
  simulateSnapshot(bufferId: string, snapshot: PixelBufferSnapshot): void;
}

function createMockTransport(clientId = "client-A"): MockTransport {
  const sentCommands: PixelNetworkCommand[] = [];
  const subscribedBuffers: string[] = [];
  const unsubscribedBuffers: string[] = [];

  return {
    localClientId: clientId,
    sentCommands,
    subscribedBuffers,
    unsubscribedBuffers,
    onCommand: null,
    onSnapshot: null,
    onPeerJoined: null,
    onPeerLeft: null,
    sendCommand(cmd) {
      sentCommands.push(cmd);
    },
    subscribe(bufferId) {
      subscribedBuffers.push(bufferId);
    },
    unsubscribe(bufferId) {
      unsubscribedBuffers.push(bufferId);
    },
    simulateCommand(cmd) {
      this.onCommand?.(cmd);
    },
    simulateSnapshot(bufferId, snapshot) {
      this.onSnapshot?.(bufferId, snapshot);
    }
  };
}

// ---------------------------------------------------------------------------
// attach / createBuffer / detach / removeBuffer
// ---------------------------------------------------------------------------

describe("PixelSyncSession — attach", () => {
  it("sets manager.onBufferUpdated", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });

    assert.strictEqual(manager.onBufferUpdated, undefined);
    session.attach("tex1", manager as unknown as PixelArtCanvas);
    assert.ok(manager.onBufferUpdated !== undefined);
  });

  it("subscribes to the buffer via the transport", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });

    session.attach("tex1", manager as unknown as PixelArtCanvas);

    assert.deepStrictEqual(transport.subscribedBuffers, ["tex1"]);
  });

  it("throws when attaching the same bufferId twice", () => {
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", createMockManager() as unknown as PixelArtCanvas);

    assert.throws(() => session.attach("tex1", createMockManager() as unknown as PixelArtCanvas));
  });
});

describe("PixelSyncSession — createBuffer", () => {
  it("attaches and sends a buffer-added command", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });

    session.createBuffer("tex1", manager as unknown as PixelArtCanvas, { size: { x: 4, y: 4 } });

    assert.strictEqual(transport.sentCommands.length, 1);
    const cmd = transport.sentCommands[0];
    assert.strictEqual(cmd.action, "buffer-added");
    assert.strictEqual(cmd.bufferId, "tex1");
    assert.strictEqual(cmd.clientId, "client-A");
  });
});

describe("PixelSyncSession — detach / removeBuffer", () => {
  it("detach clears manager.onBufferUpdated and unsubscribes", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    session.detach("tex1");

    assert.strictEqual(manager.onBufferUpdated, undefined);
    assert.deepStrictEqual(transport.unsubscribedBuffers, ["tex1"]);
  });

  it("detach on an unattached bufferId is a no-op", () => {
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    assert.doesNotThrow(() => session.detach("no-such"));
  });

  it("removeBuffer detaches and sends a buffer-removed command", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    session.removeBuffer("tex1");

    assert.strictEqual(manager.onBufferUpdated, undefined);
    const cmd = transport.sentCommands[0];
    assert.strictEqual(cmd.action, "buffer-removed");
    assert.strictEqual(cmd.bufferId, "tex1");
  });
});

// ---------------------------------------------------------------------------
// Local mutations forwarded to transport
// ---------------------------------------------------------------------------

describe("PixelSyncSession — local mutations forwarded to transport", () => {
  it("sends a command when an attached manager fires a stroke", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    manager.triggerLocal({
      action: "stroke",
      metadata: { color: { r: 0, g: 0, b: 0, a: 255 }, positions: [{ x: 0, y: 0 }] }
    });

    assert.strictEqual(transport.sentCommands.length, 1);
    const cmd = transport.sentCommands[0];
    assert.strictEqual(cmd.action, "stroke");
    assert.strictEqual(cmd.bufferId, "tex1");
    assert.strictEqual(cmd.clientId, "client-A");
  });

  it("stamps each command with an incrementing seq and a timestamp", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-B");
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    const before = Date.now();
    manager.triggerLocal({ action: "resized", metadata: { size: { x: 1, y: 1 } } });
    manager.triggerLocal({ action: "resized", metadata: { size: { x: 2, y: 2 } } });

    assert.strictEqual(transport.sentCommands[0].seq, 1);
    assert.strictEqual(transport.sentCommands[1].seq, 2);
    assert.ok(transport.sentCommands[0].timestamp >= before);
  });

  it("routes events from different managers to their own bufferId", () => {
    const managerA = createMockManager();
    const managerB = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", managerA as unknown as PixelArtCanvas);
    session.attach("tex2", managerB as unknown as PixelArtCanvas);

    managerB.triggerLocal({ action: "resized", metadata: { size: { x: 1, y: 1 } } });

    assert.strictEqual(transport.sentCommands.length, 1);
    assert.strictEqual(transport.sentCommands[0].bufferId, "tex2");
  });
});

// ---------------------------------------------------------------------------
// Remote commands routed by bufferId
// ---------------------------------------------------------------------------

describe("PixelSyncSession — remote commands", () => {
  it("routes a mutation command to the matching manager", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    transport.simulateCommand({
      action: "stroke",
      bufferId: "tex1",
      metadata: { color: { r: 1, g: 1, b: 1, a: 255 }, positions: [{ x: 0, y: 0 }] },
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    });

    assert.strictEqual(manager.appliedCommands.length, 1);
  });

  it("ignores commands echoed back from the local client", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    transport.simulateCommand({
      action: "stroke",
      bufferId: "tex1",
      metadata: { color: { r: 1, g: 1, b: 1, a: 255 }, positions: [{ x: 0, y: 0 }] },
      clientId: "client-A",
      seq: 1,
      timestamp: Date.now()
    });

    assert.strictEqual(manager.appliedCommands.length, 0);
  });

  it("ignores commands for a bufferId with no attached manager", () => {
    const transport = createMockTransport("client-A");
    new PixelSyncSession({ transport });

    assert.doesNotThrow(() => {
      transport.simulateCommand({
        action: "stroke",
        bufferId: "unknown",
        metadata: { color: { r: 1, g: 1, b: 1, a: 255 }, positions: [{ x: 0, y: 0 }] },
        clientId: "client-B",
        seq: 1,
        timestamp: Date.now()
      });
    });
  });

  it("routes buffer-added to onBufferAdded instead of a manager", () => {
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    const received: { bufferId: string; size: unknown; }[] = [];
    session.onBufferAdded = (bufferId, metadata) => received.push({ bufferId, size: metadata.size });

    transport.simulateCommand({
      action: "buffer-added",
      bufferId: "tex1",
      metadata: { size: { x: 4, y: 4 } },
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].bufferId, "tex1");
  });

  it("routes buffer-removed to onBufferRemoved and detaches the manager", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);
    const removed: string[] = [];
    session.onBufferRemoved = (bufferId) => removed.push(bufferId);

    transport.simulateCommand({
      action: "buffer-removed",
      bufferId: "tex1",
      metadata: {},
      clientId: "client-B",
      seq: 1,
      timestamp: Date.now()
    });

    assert.deepStrictEqual(removed, ["tex1"]);
    assert.strictEqual(manager.onBufferUpdated, undefined);
  });
});

// ---------------------------------------------------------------------------
// Snapshot loading
// ---------------------------------------------------------------------------

describe("PixelSyncSession — snapshot loading", () => {
  it("calls manager.loadSnapshot with decoded pixels when a snapshot arrives", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    const pixels = new Uint8ClampedArray([1, 2, 3, 255]);
    const base64 = Buffer.from(pixels).toString("base64");
    transport.simulateSnapshot("tex1", { size: { x: 1, y: 1 }, pixels: base64 });

    assert.strictEqual(manager.loadedSnapshots.length, 1);
    assert.deepStrictEqual(manager.loadedSnapshots[0].size, { x: 1, y: 1 });
    assert.deepStrictEqual(Array.from(manager.loadedSnapshots[0].pixels), [1, 2, 3, 255]);
  });

  it("ignores a snapshot for a bufferId with no attached manager", () => {
    const transport = createMockTransport();
    new PixelSyncSession({ transport });

    assert.doesNotThrow(() => {
      transport.simulateSnapshot("unknown", { size: { x: 1, y: 1 }, pixels: "" });
    });
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("PixelSyncSession — destroy", () => {
  it("detaches every buffer and clears transport callbacks", () => {
    const managerA = createMockManager();
    const managerB = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", managerA as unknown as PixelArtCanvas);
    session.attach("tex2", managerB as unknown as PixelArtCanvas);

    session.destroy();

    assert.strictEqual(managerA.onBufferUpdated, undefined);
    assert.strictEqual(managerB.onBufferUpdated, undefined);
    assert.strictEqual(transport.onCommand, null);
    assert.strictEqual(transport.onSnapshot, null);
  });

  it("stops forwarding local mutations after destroy", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach("tex1", manager as unknown as PixelArtCanvas);

    session.destroy();
    manager.triggerLocal({ action: "resized", metadata: { size: { x: 1, y: 1 } } });

    assert.strictEqual(transport.sentCommands.length, 0);
  });
});
