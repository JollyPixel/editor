// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelSyncSession } from "#src/network/PixelSyncSession.ts";
import type { PixelTransport } from "#src/network/PixelTransport.ts";
import type {
  PixelNetworkCommand,
  PixelBufferSnapshot
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

// PixelSyncSession is typed against the concrete PixelArtCanvas, but only uses
// the structural subset MockManager implements (onBufferUpdated,
// applyRemoteCommand, loadSnapshot). This single helper documents that seam so
// the individual call sites stay cast-free.
function asHost(
  manager: MockManager
): PixelArtCanvas {
  return manager as unknown as PixelArtCanvas;
}

interface MockTransport extends PixelTransport {
  sentCommands: PixelNetworkCommand[];
  simulateCommand(cmd: PixelNetworkCommand): void;
  simulateSnapshot(snapshot: PixelBufferSnapshot): void;
}

function createMockTransport(
  clientId = "client-A"
): MockTransport {
  const sentCommands: PixelNetworkCommand[] = [];

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
    simulateCommand(cmd) {
      this.onCommand?.(cmd);
    },
    simulateSnapshot(snapshot) {
      this.onSnapshot?.(snapshot);
    }
  };
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("PixelSyncSession — attach", () => {
  test("sets manager.onBufferUpdated", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });

    assert.strictEqual(manager.onBufferUpdated, undefined);
    session.attach(asHost(manager));
    assert.ok(manager.onBufferUpdated !== undefined);
  });

  test("throws when a canvas is already attached", () => {
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(createMockManager()));

    assert.throws(() => session.attach(asHost(createMockManager())));
  });
});

describe("PixelSyncSession — chaining onBufferUpdated", () => {
  test("attach preserves an existing local handler instead of replacing it", () => {
    const manager = createMockManager();
    const received: PixelBufferHookEvent[] = [];
    manager.onBufferUpdated = (event) => received.push(event);

    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    manager.triggerLocal({
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(transport.sentCommands.length, 1);
  });

  test("detach restores the handler that was present before attach", () => {
    const manager = createMockManager();
    const received: PixelBufferHookEvent[] = [];
    function original(event: PixelBufferHookEvent): void {
      received.push(event);
    }
    manager.onBufferUpdated = original;

    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));
    session.detach();

    assert.strictEqual(manager.onBufferUpdated, original);

    manager.triggerLocal({
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(transport.sentCommands.length, 0);
  });

  test("detach without an attached manager is a no-op", () => {
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    assert.doesNotThrow(() => session.detach());
  });
});

// ---------------------------------------------------------------------------
// Local mutations forwarded to transport
// ---------------------------------------------------------------------------

describe("PixelSyncSession — local mutations forwarded to transport", () => {
  test("sends a command when an attached manager fires a stroke", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    manager.triggerLocal({
      action: "stroke",
      metadata: {
        color: { r: 0, g: 0, b: 0, a: 255 },
        positions: [
          { x: 0, y: 0 }
        ]
      }
    });

    assert.strictEqual(transport.sentCommands.length, 1);
    const cmd = transport.sentCommands[0];
    assert.strictEqual(cmd.action, "stroke");
    assert.strictEqual(cmd.clientId, "client-A");
  });

  test("stamps each command with an incrementing seq and a timestamp", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-B");
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

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

    assert.strictEqual(transport.sentCommands[0].seq, 1);
    assert.strictEqual(transport.sentCommands[1].seq, 2);
    assert.ok(transport.sentCommands[0].timestamp >= before);
  });
});

// ---------------------------------------------------------------------------
// Remote commands
// ---------------------------------------------------------------------------

describe("PixelSyncSession — remote commands", () => {
  test("routes a mutation command to the attached manager", () => {
    const manager = createMockManager();
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    transport.simulateCommand({
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
    const transport = createMockTransport("client-A");
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    transport.simulateCommand({
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
    const transport = createMockTransport("client-A");
    new PixelSyncSession({ transport });

    assert.doesNotThrow(() => {
      transport.simulateCommand({
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

describe("PixelSyncSession — snapshot loading", () => {
  test("calls manager.loadSnapshot with decoded pixels when a snapshot arrives", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    const pixels = new Uint8ClampedArray([1, 2, 3, 255]);
    const base64 = Buffer.from(pixels).toString("base64");
    transport.simulateSnapshot({
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
    const transport = createMockTransport();
    new PixelSyncSession({ transport });

    assert.doesNotThrow(() => {
      transport.simulateSnapshot(
        { size: { x: 1, y: 1 }, pixels: "", uvRegions: [] }
      );
    });
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("PixelSyncSession — destroy", () => {
  test("detaches the canvas and clears transport callbacks", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    session.destroy();

    assert.strictEqual(manager.onBufferUpdated, undefined);
    assert.strictEqual(transport.onCommand, null);
    assert.strictEqual(transport.onSnapshot, null);
  });

  test("stops forwarding local mutations after destroy", () => {
    const manager = createMockManager();
    const transport = createMockTransport();
    const session = new PixelSyncSession({ transport });
    session.attach(asHost(manager));

    session.destroy();
    manager.triggerLocal({
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    });

    assert.strictEqual(transport.sentCommands.length, 0);
  });
});
