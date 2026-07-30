// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { PixelCursorSync } from "#src/network/PixelCursorSync.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "#src/network/types.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { Vec2 } from "#src/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRoom extends network.Room<PixelNetworkCommand, PixelServerMessage> {
  presenceUpdates: network.PeerMetadata[];
  addPeer(clientId: string, identity?: network.PeerMetadata, presence?: network.PeerMetadata): void;
  simulateJoin(clientId: string): void;
  simulateLeave(clientId: string): void;
  simulatePresence(clientId: string, patch: network.PeerMetadata): void;
}

function createMockRoom(
  clientId = "local-A"
): MockRoom {
  const peersMap = new Map<string, network.Peer>();
  const presenceUpdates: network.PeerMetadata[] = [];
  const listeners = new Map<string, Set<(payload: any) => void>>();

  function emit(type: string, payload: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  const room: MockRoom = {
    id: "test-room",
    clientId,
    peers: peersMap,
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
      // Unused by PixelCursorSync.
    },
    send() {
      // Unused by PixelCursorSync.
    },
    updatePresence(patch) {
      presenceUpdates.push(patch);
    },
    leave() {
      // Unused by PixelCursorSync.
    },
    addPeer(id, identity = {}, presence = {}) {
      peersMap.set(id, { clientId: id, identity, presence });
    },
    simulateJoin(id) {
      emit("peer-joined", { clientId: id });
    },
    simulateLeave(id) {
      emit("peer-left", { clientId: id });
    },
    simulatePresence(id, patch) {
      emit("peer-presence", { clientId: id, patch });
    }
  };

  return room;
}

interface PeerCursorCall {
  clientId: string;
  pos: Vec2 | null;
  color: string;
  label: string | undefined;
}

interface MockCanvas {
  onCursorMove: ((pos: Vec2 | null) => void) | undefined;
  setCalls: PeerCursorCall[];
  removedPeers: string[];
  peerCursors: {
    set(clientId: string, state: { pos: Vec2 | null; color: string; label?: string; }): void;
    remove(clientId: string): void;
  };
  triggerCursorMove(pos: Vec2 | null): void;
}

function createMockCanvas(): MockCanvas {
  const setCalls: PeerCursorCall[] = [];
  const removedPeers: string[] = [];

  const canvas: MockCanvas = {
    onCursorMove: undefined,
    setCalls,
    removedPeers,
    peerCursors: {
      set(clientId, state) {
        setCalls.push({ clientId, pos: state.pos, color: state.color, label: state.label });
      },
      remove(clientId) {
        removedPeers.push(clientId);
      }
    },
    triggerCursorMove(pos) {
      canvas.onCursorMove?.(pos);
    }
  };

  return canvas;
}

// PixelCursorSync is typed against the concrete PixelArtCanvas, but only
// uses the structural subset MockCanvas implements (onCursorMove, peerCursors).
function asHost(
  canvas: MockCanvas
): PixelArtCanvas {
  return canvas as unknown as PixelArtCanvas;
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("PixelCursorSync — attach", () => {
  test("sets canvas.onCursorMove", () => {
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room: createMockRoom() });

    assert.strictEqual(canvas.onCursorMove, undefined);
    sync.attach(asHost(canvas));
    assert.ok(canvas.onCursorMove !== undefined);
  });

  test("throws when a canvas is already attached", () => {
    const sync = new PixelCursorSync({ room: createMockRoom() });
    sync.attach(asHost(createMockCanvas()));

    assert.throws(() => sync.attach(asHost(createMockCanvas())));
  });

  test("seeds already-connected peers that already reported a cursor", () => {
    const room = createMockRoom();
    room.addPeer("peer-B", { username: "Bob" }, { cursor: { x: 3, y: 4 } });

    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
    assert.deepStrictEqual(canvas.setCalls[0].pos, { x: 3, y: 4 });
    assert.strictEqual(canvas.setCalls[0].label, "Bob");
  });
});

describe("PixelCursorSync — detach", () => {
  test("stops forwarding local cursor moves", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    sync.detach();
    canvas.triggerCursorMove({ x: 1, y: 1 });

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Local cursor -> presence
// ---------------------------------------------------------------------------

describe("PixelCursorSync — local cursor reporting", () => {
  test("forwards a local cursor move as a presence update", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerCursorMove({ x: 5, y: 6 });

    assert.strictEqual(room.presenceUpdates.length, 1);
    assert.deepStrictEqual(room.presenceUpdates[0], { cursor: { x: 5, y: 6 } });
  });

  test("dedupes consecutive identical positions", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerCursorMove({ x: 5, y: 6 });
    canvas.triggerCursorMove({ x: 5, y: 6 });

    assert.strictEqual(room.presenceUpdates.length, 1);
  });

  test("still reports leaving the canvas (null) after a real position", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    canvas.triggerCursorMove({ x: 5, y: 6 });
    canvas.triggerCursorMove(null);

    assert.strictEqual(room.presenceUpdates.length, 2);
    assert.deepStrictEqual(room.presenceUpdates[1], { cursor: null });
  });
});

// ---------------------------------------------------------------------------
// Remote peers -> overlay
// ---------------------------------------------------------------------------

describe("PixelCursorSync — remote peers", () => {
  test("onPeerPresence with a cursor patch updates the overlay", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    // Added after attach() so the seeding loop doesn't produce an extra call.
    room.addPeer("peer-B", { username: "Bob" });
    room.simulatePresence("peer-B", { cursor: { x: 1, y: 2 } });

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
    assert.deepStrictEqual(canvas.setCalls[0].pos, { x: 1, y: 2 });
    assert.strictEqual(canvas.setCalls[0].label, "Bob");
    assert.ok(canvas.setCalls[0].color.length > 0);
  });

  test("ignores presence patches that don't touch the cursor field", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    // Added after attach() so the seeding loop doesn't produce an extra call.
    room.addPeer("peer-B");
    room.simulatePresence("peer-B", { somethingElse: true });

    assert.strictEqual(canvas.setCalls.length, 0);
  });

  test("onPeerJoined syncs that peer's current presence", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    room.addPeer("peer-C", { username: "Cara" }, { cursor: { x: 7, y: 8 } });
    room.simulateJoin("peer-C");

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].label, "Cara");
  });

  test("onPeerLeft removes that peer's cursor from the overlay", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    room.simulateLeave("peer-B");

    assert.deepStrictEqual(canvas.removedPeers, ["peer-B"]);
  });

  test("a custom getLabel option overrides the default identity.username lookup", () => {
    const room = createMockRoom();
    room.addPeer("peer-B", { displayName: "Bobby" });

    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({
      room,
      getLabel: (identity) => identity.displayName as string
    });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { cursor: { x: 0, y: 0 } });

    assert.strictEqual(canvas.setCalls[0].label, "Bobby");
  });
});

// ---------------------------------------------------------------------------
// Coexists with other room listeners
// ---------------------------------------------------------------------------

describe("PixelCursorSync — coexists with other room listeners", () => {
  test("doesn't clobber peer-joined/peer-left/peer-presence listeners registered before construction", () => {
    const room = createMockRoom();
    const seenJoins: string[] = [];
    const seenLeaves: string[] = [];
    const seenPresence: string[] = [];
    room.on("peer-joined", (event) => seenJoins.push(event.clientId));
    room.on("peer-left", (event) => seenLeaves.push(event.clientId));
    room.on("peer-presence", (event) => seenPresence.push(event.clientId));

    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    room.addPeer("peer-B");
    room.simulateJoin("peer-B");
    room.simulateLeave("peer-B");
    room.simulatePresence("peer-B", { cursor: null });

    assert.deepStrictEqual(seenJoins, ["peer-B"]);
    assert.deepStrictEqual(seenLeaves, ["peer-B"]);
    assert.deepStrictEqual(seenPresence, ["peer-B"]);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("PixelCursorSync — destroy", () => {
  test("removes only its own listeners and detaches the canvas", () => {
    const room = createMockRoom();
    const otherJoins: string[] = [];
    room.on("peer-joined", (event) => otherJoins.push(event.clientId));

    const canvas = createMockCanvas();
    const sync = new PixelCursorSync({ room });
    sync.attach(asHost(canvas));

    sync.destroy();
    room.addPeer("peer-B");
    room.simulateJoin("peer-B");

    assert.strictEqual(canvas.onCursorMove, undefined);
    // The other listener registered independently is unaffected by destroy().
    assert.deepStrictEqual(otherJoins, ["peer-B"]);
    // PixelCursorSync's own listener was removed, so the canvas overlay saw nothing.
    assert.strictEqual(canvas.setCalls.length, 0);
  });
});
