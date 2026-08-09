// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { UVGhostSync } from "#src/network/UVGhostSync.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  UVGhostPayload
} from "#src/network/types.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PeerUVGhostState } from "#src/rendering/overlays/PeerUVGhosts.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRoom extends network.Room<PixelNetworkCommand, PixelServerMessage> {
  presenceUpdates: network.PeerMetadata[];
  addPeer(clientId: string, presence: network.PeerMetadata): void;
  simulateLeave(clientId: string): void;
  simulatePresence(clientId: string, patch: network.PeerMetadata): void;
  simulateMoveCommand(regionId: string): void;
  simulateDeleteCommand(regionId: string): void;
  simulateStateChangedCommand(regionId: string): void;
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
      // Unused by UVGhostSync.
    },
    send() {
      // Unused by UVGhostSync.
    },
    updatePresence(patch) {
      presenceUpdates.push(patch);
    },
    leave() {
      // Unused by UVGhostSync.
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
    simulateMoveCommand(regionId) {
      emit("message", {
        type: "command",
        data: {
          clientId: "peer-B",
          action: "uv-region-moved",
          metadata: { id: regionId, face: null, rect: { x: 0, y: 0, width: 1, height: 1 } }
        }
      });
    },
    simulateDeleteCommand(regionId) {
      emit("message", {
        type: "command",
        data: { clientId: "peer-B", action: "uv-region-deleted", metadata: { id: regionId } }
      });
    },
    simulateStateChangedCommand(regionId) {
      emit("message", {
        type: "command",
        data: { clientId: "peer-B", action: "uv-region-state-changed", metadata: { region: { id: regionId } } }
      });
    },
    simulateSnapshot() {
      emit("message", { type: "snapshot", data: {} });
    }
  };

  return room;
}

interface MockUVMap {
  on(type: string, listener: (event: any) => void): void;
  off(type: string, listener: (event: any) => void): void;
  simulateDragging(payload: UVGhostPayload): void;
  simulateMoved(regionId: string): void;
}

function createMockUVMap(): MockUVMap {
  const listeners = new Map<string, Set<(event: any) => void>>();

  function emit(type: string, event: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
  }

  return {
    on(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    off(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    simulateDragging(payload) {
      emit("region-dragging", payload);
    },
    simulateMoved(regionId) {
      emit("region-moved", { region: { id: regionId }, face: null, previousRect: { x: 0, y: 0, width: 1, height: 1 } });
    }
  };
}

interface MockCanvas {
  uv: MockUVMap;
  setCalls: { clientId: string; state: PeerUVGhostState; }[];
  removedPeers: string[];
  clearAllCallCount: number;
  removeByRegionCalls: string[];
  peerUvGhosts: {
    set(clientId: string, state: PeerUVGhostState): void;
    remove(clientId: string): void;
    clearAll(): void;
    removeByRegion(id: string): void;
  };
}

function createMockCanvas(): MockCanvas {
  const setCalls: { clientId: string; state: PeerUVGhostState; }[] = [];
  const removedPeers: string[] = [];
  const removeByRegionCalls: string[] = [];

  const canvas: MockCanvas = {
    uv: createMockUVMap(),
    setCalls,
    removedPeers,
    clearAllCallCount: 0,
    removeByRegionCalls,
    peerUvGhosts: {
      set(clientId, state) {
        setCalls.push({ clientId, state });
      },
      remove(clientId) {
        removedPeers.push(clientId);
      },
      clearAll() {
        canvas.clearAllCallCount++;
      },
      removeByRegion(id) {
        removeByRegionCalls.push(id);
      }
    }
  };

  return canvas;
}

// UVGhostSync is typed against the concrete PixelArtCanvas, but only uses the
// structural subset MockCanvas implements (uv, peerUvGhosts).
function asHost(
  canvas: MockCanvas
): PixelArtCanvas {
  return canvas as unknown as PixelArtCanvas;
}

const kPayload: UVGhostPayload = {
  id: "region-A",
  face: null,
  geometry: { x: 0, y: 0, width: 4, height: 4 }
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("UVGhostSync — attach", () => {
  test("throws when a canvas is already attached", () => {
    const sync = new UVGhostSync({ room: createMockRoom() });
    sync.attach(asHost(createMockCanvas()));

    assert.throws(() => sync.attach(asHost(createMockCanvas())));
  });

  test("seeds ghost presence already stored on the room", () => {
    const room = createMockRoom();
    room.addPeer("peer-B", { uvGhost: kPayload });
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });

    sync.attach(asHost(canvas));

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
  });

  test("enableGhostPreview: false never wires the region-dragging listener", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room, enableGhostPreview: false });
    sync.attach(asHost(canvas));

    canvas.uv.simulateDragging(kPayload);
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

describe("UVGhostSync — detach", () => {
  test("stops forwarding local drag progress", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    sync.detach();
    canvas.uv.simulateDragging(kPayload);
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Local drag -> presence (rAF-gated)
// ---------------------------------------------------------------------------

describe("UVGhostSync — local drag reporting", () => {
  test("forwards a local region-dragging event as a presence update on the next frame", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.uv.simulateDragging(kPayload);
    assert.strictEqual(room.presenceUpdates.length, 0, "not sent synchronously");

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1);
    assert.deepStrictEqual(room.presenceUpdates[0], { uvGhost: kPayload });
  });

  test("a region-moved commit for the pending region cancels its queued pre-commit send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    // Mirrors the real race: handleMove() queues an rAF send, then the
    // synchronous handleEnd()/uvMap.move() commit fires "region-moved"
    // before that frame runs — the stale pre-commit geometry must never
    // reach the wire and resurrect a ghost peers just saw cleared.
    canvas.uv.simulateDragging(kPayload);
    canvas.uv.simulateMoved(kPayload.id);

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 0);
  });

  test("a region-moved commit for a different region leaves the pending send untouched", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.uv.simulateDragging(kPayload);
    canvas.uv.simulateMoved("some-other-region");

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1);
  });

  test("coalesces multiple updates within the same frame into a single send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.uv.simulateDragging(kPayload);
    canvas.uv.simulateDragging({ ...kPayload, geometry: { x: 1, y: 1, width: 4, height: 4 } });

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1, "only the latest snapshot is sent");
  });
});

// ---------------------------------------------------------------------------
// Remote peers -> overlay
// ---------------------------------------------------------------------------

describe("UVGhostSync — remote peers", () => {
  test("a uvGhost presence patch updates the overlay", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { uvGhost: kPayload });

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
    assert.strictEqual(canvas.setCalls[0].state.id, kPayload.id);
    assert.ok(canvas.setCalls[0].state.color.length > 0, "a peer color was hashed in");
  });

  test("expires a peer ghost after 1500ms without an update", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { uvGhost: kPayload });
    t.mock.timers.tick(1499);
    assert.deepStrictEqual(canvas.removedPeers, []);

    t.mock.timers.tick(1);
    assert.deepStrictEqual(canvas.removedPeers, ["peer-B"]);
  });

  test("ignores presence patches that don't touch the uvGhost field", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { somethingElse: true });

    assert.strictEqual(canvas.setCalls.length, 0);
  });

  test("ignores a malformed uvGhost payload", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { uvGhost: "not-an-object" });
    room.simulatePresence("peer-B", { uvGhost: { face: null } });

    assert.strictEqual(canvas.setCalls.length, 0);
  });

  test("onPeerLeft removes that peer's ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateLeave("peer-B");

    assert.deepStrictEqual(canvas.removedPeers, ["peer-B"]);
  });
});

// ---------------------------------------------------------------------------
// Reconciliation with the authoritative pipeline
// ---------------------------------------------------------------------------

describe("UVGhostSync — reconciliation", () => {
  // Region identity remains the stable reconciliation key when a custom
  // server produces commands without normalizing client identity.
  test("an incoming uv-region-moved command clears ghosts by region id, not by clientId", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateMoveCommand("region-A");

    assert.deepStrictEqual(canvas.removeByRegionCalls, ["region-A"]);
    assert.strictEqual(canvas.removedPeers.length, 0, "no longer matches by clientId");
  });

  test("an incoming uv-region-deleted command clears ghosts by region id", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateDeleteCommand("region-A");

    assert.deepStrictEqual(canvas.removeByRegionCalls, ["region-A"]);
  });

  test("an incoming uv-region-state-changed command clears ghosts by region id", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateStateChangedCommand("region-A");

    assert.deepStrictEqual(canvas.removeByRegionCalls, ["region-A"]);
  });

  test("an incoming snapshot clears every peer's ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateSnapshot();

    assert.strictEqual(canvas.clearAllCallCount, 1);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("UVGhostSync — destroy", () => {
  test("removes only its own listeners and detaches the canvas", () => {
    const room = createMockRoom();
    const otherLeaves: string[] = [];
    room.on("peer-left", (event) => otherLeaves.push(event.clientId));

    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    sync.destroy();
    room.simulateLeave("peer-B");

    assert.deepStrictEqual(otherLeaves, ["peer-B"]);
    assert.strictEqual(canvas.removedPeers.length, 0);
  });

  test("cancels a pending rAF-scheduled send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new UVGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.uv.simulateDragging(kPayload);
    sync.destroy();
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});
