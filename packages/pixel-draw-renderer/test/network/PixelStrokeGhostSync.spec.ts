// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { PixelStrokeGhostSync } from "#src/network/PixelStrokeGhostSync.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "#src/network/types.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PeerStrokePixel, Vec2 } from "#src/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRoom extends network.Room<PixelNetworkCommand, PixelServerMessage> {
  presenceUpdates: network.PeerMetadata[];
  addPeer(clientId: string, presence: network.PeerMetadata): void;
  simulateLeave(clientId: string): void;
  simulatePresence(clientId: string, patch: network.PeerMetadata): void;
  simulateStrokeCommand(positions: Vec2[]): void;
  simulateWholeCanvasCommand(): void;
  simulateSnapshot(): void;
}

function createMockRoom(): MockRoom {
  const presenceUpdates: network.PeerMetadata[] = [];
  const peers = new Map<string, network.Peer>();
  const listeners = new Map<string, Set<(payload: any) => void>>();

  function emit(type: string, payload: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  const room: MockRoom = {
    id: "test-room",
    clientId: "local-A",
    peers,
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
    presenceUpdates,
    join() {
      // Unused by PixelStrokeGhostSync.
    },
    send() {
      // Unused by PixelStrokeGhostSync.
    },
    updatePresence(patch) {
      presenceUpdates.push(patch);
    },
    leave() {
      // Unused by PixelStrokeGhostSync.
    },
    addPeer(clientId, presence) {
      peers.set(clientId, {
        clientId,
        identity: {},
        presence
      });
    },
    simulateLeave(clientId) {
      emit("peer-left", { clientId });
    },
    simulatePresence(clientId, patch) {
      emit("peer-presence", { clientId, patch });
    },
    simulateStrokeCommand(positions) {
      emit("message", {
        type: "command",
        data: { clientId: "peer-B", action: "stroke", metadata: { positions, color: { r: 0, g: 0, b: 0, a: 255 } } }
      });
    },
    simulateWholeCanvasCommand() {
      emit("message", {
        type: "command",
        data: { clientId: "peer-B", action: "resized", metadata: { size: { x: 1, y: 1 } } }
      });
    },
    simulateSnapshot() {
      emit("message", { type: "snapshot", data: {} });
    }
  };

  return room;
}

interface MockCanvas {
  onStrokeProgress: ((pixels: PeerStrokePixel[]) => void) | undefined;
  setCalls: { clientId: string; pixels: PeerStrokePixel[]; }[];
  removedPeers: string[];
  clearAllCallCount: number;
  overlapCalls: Vec2[][];
  peerPresence: {
    strokes: {
      set(clientId: string, pixels: PeerStrokePixel[]): void;
      remove(clientId: string): void;
      clearAll(): void;
      removeOverlapping(positions: Vec2[]): void;
    };
  };
  triggerProgress(pixels: PeerStrokePixel[]): void;
}

function createMockCanvas(): MockCanvas {
  const setCalls: { clientId: string; pixels: PeerStrokePixel[]; }[] = [];
  const removedPeers: string[] = [];
  const overlapCalls: Vec2[][] = [];

  const canvas: MockCanvas = {
    onStrokeProgress: undefined,
    setCalls,
    removedPeers,
    clearAllCallCount: 0,
    overlapCalls,
    peerPresence: {
      strokes: {
        set(clientId, pixels) {
          setCalls.push({ clientId, pixels });
        },
        remove(clientId) {
          removedPeers.push(clientId);
        },
        clearAll() {
          canvas.clearAllCallCount++;
        },
        removeOverlapping(positions) {
          overlapCalls.push(positions);
        }
      }
    },
    triggerProgress(pixels) {
      canvas.onStrokeProgress?.(pixels);
    }
  };

  return canvas;
}

// PixelStrokeGhostSync is typed against the concrete PixelArtCanvas, but only
// uses the structural subset MockCanvas implements.
function asHost(
  canvas: MockCanvas
): PixelArtCanvas {
  return canvas as unknown as PixelArtCanvas;
}

const kPixel: PeerStrokePixel = { x: 1, y: 2, color: { r: 255, g: 0, b: 0, a: 255 } };

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("PixelStrokeGhostSync — attach", () => {
  test("sets canvas.onStrokeProgress", () => {
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room: createMockRoom() });

    assert.strictEqual(canvas.onStrokeProgress, undefined);
    sync.attach(asHost(canvas));
    assert.ok(canvas.onStrokeProgress !== undefined);
  });

  test("throws when a canvas is already attached", () => {
    const sync = new PixelStrokeGhostSync({ room: createMockRoom() });
    sync.attach(asHost(createMockCanvas()));

    assert.throws(() => sync.attach(asHost(createMockCanvas())));
  });

  test("enableGhostPreview: false leaves onStrokeProgress untouched", () => {
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({
      room: createMockRoom(),
      enableGhostPreview: false
    });

    sync.attach(asHost(canvas));
    assert.strictEqual(canvas.onStrokeProgress, undefined);
  });

  test("seeds ghost presence already stored on the room", () => {
    const room = createMockRoom();
    room.addPeer("peer-B", { strokeGhost: [kPixel] });
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });

    sync.attach(asHost(canvas));

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
  });
});

describe("PixelStrokeGhostSync — detach", () => {
  test("chains and restores an existing progress listener", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const seen: PeerStrokePixel[][] = [];
    function previous(pixels: PeerStrokePixel[]): void {
      seen.push(pixels);
    }
    canvas.onStrokeProgress = previous;
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerProgress([kPixel]);
    sync.detach();

    assert.deepStrictEqual(seen, [[kPixel]]);
    assert.strictEqual(canvas.onStrokeProgress, previous);
  });

  test("leaves an existing listener untouched when preview is disabled", () => {
    const canvas = createMockCanvas();
    function previous(): void {
      // Existing application listener.
    }
    canvas.onStrokeProgress = previous;
    const sync = new PixelStrokeGhostSync({
      room: createMockRoom(),
      enableGhostPreview: false
    });
    sync.attach(asHost(canvas));

    sync.detach();

    assert.strictEqual(canvas.onStrokeProgress, previous);
  });

  test("stops forwarding local stroke progress", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    sync.detach();
    canvas.triggerProgress([kPixel]);

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Local progress -> presence (rAF-gated)
// ---------------------------------------------------------------------------

describe("PixelStrokeGhostSync — local stroke reporting", () => {
  test("forwards local stroke pixels as a presence update on the next frame", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerProgress([kPixel]);
    assert.strictEqual(room.presenceUpdates.length, 0, "not sent synchronously");

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1);
    assert.deepStrictEqual(room.presenceUpdates[0], { strokeGhost: [kPixel] });
  });

  test("an empty-array progress report (gesture just committed) cancels a pending pre-commit send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    // Mirrors the real race: a stroke tick queues an rAF send, then the
    // synchronous commit (endStroke/commit/handleEnd) reports [] before that
    // frame fires — the stale pre-commit pixels must never reach the wire.
    canvas.triggerProgress([kPixel]);
    canvas.triggerProgress([]);

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 0);
  });

  test("coalesces multiple updates within the same frame into a single send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerProgress([kPixel]);
    canvas.triggerProgress([kPixel, kPixel]);

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1, "only the latest snapshot is sent");
    assert.strictEqual(room.presenceUpdates[0].strokeGhost.length, 2);
  });

  test("enableGhostPreview: false never sends", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room, enableGhostPreview: false });
    sync.attach(asHost(canvas));

    canvas.triggerProgress([kPixel]);
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Remote peers -> overlay
// ---------------------------------------------------------------------------

describe("PixelStrokeGhostSync — remote peers", () => {
  test("a strokeGhost presence patch updates the overlay", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { strokeGhost: [kPixel] });

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
    assert.deepStrictEqual(canvas.setCalls[0].pixels, [kPixel]);
  });

  test("expires a peer ghost after 1500ms without an update", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { strokeGhost: [kPixel] });
    t.mock.timers.tick(1499);
    assert.deepStrictEqual(canvas.removedPeers, []);

    t.mock.timers.tick(1);
    assert.deepStrictEqual(canvas.removedPeers, ["peer-B"]);
  });

  test("ignores presence patches that don't touch the strokeGhost field", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { somethingElse: true });

    assert.strictEqual(canvas.setCalls.length, 0);
  });

  test("ignores a malformed strokeGhost payload", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { strokeGhost: "not-an-array" });
    room.simulatePresence("peer-B", { strokeGhost: [{ x: 1 }] });

    assert.strictEqual(canvas.setCalls.length, 0);
  });

  test("onPeerLeft removes that peer's ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateLeave("peer-B");

    assert.deepStrictEqual(canvas.removedPeers, ["peer-B"]);
  });
});

// ---------------------------------------------------------------------------
// Reconciliation with the authoritative pipeline
// ---------------------------------------------------------------------------

describe("PixelStrokeGhostSync — reconciliation", () => {
  test("an incoming stroke command clears ghosts by overlapping pixel, not by clientId", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateStrokeCommand([{ x: 1, y: 2 }]);

    assert.strictEqual(canvas.overlapCalls.length, 1);
    assert.deepStrictEqual(canvas.overlapCalls[0], [{ x: 1, y: 2 }]);
    assert.strictEqual(canvas.removedPeers.length, 0, "no longer matches by clientId");
  });

  test("a whole-canvas command (resize/texture-replace/global-fill) clears every peer's ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateWholeCanvasCommand();

    assert.strictEqual(canvas.clearAllCallCount, 1);
  });

  test("an incoming snapshot clears every peer's ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateSnapshot();

    assert.strictEqual(canvas.clearAllCallCount, 1);
  });

  test("enableGhostPreview: false never reconciles", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room, enableGhostPreview: false });
    sync.attach(asHost(canvas));

    room.simulateStrokeCommand([{ x: 1, y: 2 }]);
    room.simulateSnapshot();

    assert.strictEqual(canvas.overlapCalls.length, 0);
    assert.strictEqual(canvas.clearAllCallCount, 0);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("PixelStrokeGhostSync — destroy", () => {
  test("removes only its own listeners and detaches the canvas", () => {
    const room = createMockRoom();
    const otherLeaves: string[] = [];
    room.on("peer-left", (event) => otherLeaves.push(event.clientId));

    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    sync.destroy();
    room.simulateLeave("peer-B");

    assert.strictEqual(canvas.onStrokeProgress, undefined);
    // The other listener registered independently is unaffected by destroy().
    assert.deepStrictEqual(otherLeaves, ["peer-B"]);
    // PixelStrokeGhostSync's own listener was removed, so the canvas saw nothing.
    assert.strictEqual(canvas.removedPeers.length, 0);
  });

  test("cancels a pending rAF-scheduled send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelStrokeGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerProgress([kPixel]);
    sync.destroy();
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});
