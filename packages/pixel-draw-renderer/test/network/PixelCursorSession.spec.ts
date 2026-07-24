// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelCursorSession } from "#src/network/PixelCursorSession.ts";
import type {
  PixelPeer,
  PixelPeerIdentity,
  PixelPeerPresence,
  PixelPresenceChannel
} from "#src/network/types.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { Vec2 } from "#src/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockChannel extends PixelPresenceChannel {
  presenceUpdates: PixelPeerPresence[];
  addPeer(clientId: string, identity?: PixelPeerIdentity, presence?: PixelPeerPresence): void;
  simulateJoin(clientId: string): void;
  simulateLeave(clientId: string): void;
  simulatePresence(clientId: string, patch: PixelPeerPresence): void;
}

function createMockChannel(
  clientId = "local-A"
): MockChannel {
  const peersMap = new Map<string, PixelPeer>();
  const presenceUpdates: PixelPeerPresence[] = [];

  const channel: MockChannel = {
    localClientId: clientId,
    peers: peersMap,
    onPeerJoined: null,
    onPeerLeft: null,
    onPeerPresence: null,
    presenceUpdates,
    updatePresence(patch) {
      presenceUpdates.push(patch);
    },
    addPeer(id, identity = {}, presence = {}) {
      peersMap.set(id, { clientId: id, identity, presence });
    },
    simulateJoin(id) {
      channel.onPeerJoined?.(id);
    },
    simulateLeave(id) {
      channel.onPeerLeft?.(id);
    },
    simulatePresence(id, patch) {
      channel.onPeerPresence?.(id, patch);
    }
  };

  return channel;
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

// PixelCursorSession is typed against the concrete PixelArtCanvas, but only
// uses the structural subset MockCanvas implements (onCursorMove, peerCursors).
function asHost(
  canvas: MockCanvas
): PixelArtCanvas {
  return canvas as unknown as PixelArtCanvas;
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("PixelCursorSession — attach", () => {
  test("sets canvas.onCursorMove", () => {
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel: createMockChannel() });

    assert.strictEqual(canvas.onCursorMove, undefined);
    session.attach(asHost(canvas));
    assert.ok(canvas.onCursorMove !== undefined);
  });

  test("throws when a canvas is already attached", () => {
    const session = new PixelCursorSession({ channel: createMockChannel() });
    session.attach(asHost(createMockCanvas()));

    assert.throws(() => session.attach(asHost(createMockCanvas())));
  });

  test("seeds already-connected peers that already reported a cursor", () => {
    const channel = createMockChannel();
    channel.addPeer("peer-B", { username: "Bob" }, { cursor: { x: 3, y: 4 } });

    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
    assert.deepStrictEqual(canvas.setCalls[0].pos, { x: 3, y: 4 });
    assert.strictEqual(canvas.setCalls[0].label, "Bob");
  });
});

describe("PixelCursorSession — detach", () => {
  test("stops forwarding local cursor moves", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    session.detach();
    canvas.triggerCursorMove({ x: 1, y: 1 });

    assert.strictEqual(channel.presenceUpdates.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Local cursor -> presence
// ---------------------------------------------------------------------------

describe("PixelCursorSession — local cursor reporting", () => {
  test("forwards a local cursor move as a presence update", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    canvas.triggerCursorMove({ x: 5, y: 6 });

    assert.strictEqual(channel.presenceUpdates.length, 1);
    assert.deepStrictEqual(channel.presenceUpdates[0], { cursor: { x: 5, y: 6 } });
  });

  test("dedupes consecutive identical positions", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    canvas.triggerCursorMove({ x: 5, y: 6 });
    canvas.triggerCursorMove({ x: 5, y: 6 });

    assert.strictEqual(channel.presenceUpdates.length, 1);
  });

  test("still reports leaving the canvas (null) after a real position", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    canvas.triggerCursorMove({ x: 5, y: 6 });
    canvas.triggerCursorMove(null);

    assert.strictEqual(channel.presenceUpdates.length, 2);
    assert.deepStrictEqual(channel.presenceUpdates[1], { cursor: null });
  });
});

// ---------------------------------------------------------------------------
// Remote peers -> overlay
// ---------------------------------------------------------------------------

describe("PixelCursorSession — remote peers", () => {
  test("onPeerPresence with a cursor patch updates the overlay", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    // Added after attach() so the seeding loop doesn't produce an extra call.
    channel.addPeer("peer-B", { username: "Bob" });
    channel.simulatePresence("peer-B", { cursor: { x: 1, y: 2 } });

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].clientId, "peer-B");
    assert.deepStrictEqual(canvas.setCalls[0].pos, { x: 1, y: 2 });
    assert.strictEqual(canvas.setCalls[0].label, "Bob");
    assert.ok(canvas.setCalls[0].color.length > 0);
  });

  test("ignores presence patches that don't touch the cursor field", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    // Added after attach() so the seeding loop doesn't produce an extra call.
    channel.addPeer("peer-B");
    channel.simulatePresence("peer-B", { somethingElse: true });

    assert.strictEqual(canvas.setCalls.length, 0);
  });

  test("onPeerJoined syncs that peer's current presence", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    channel.addPeer("peer-C", { username: "Cara" }, { cursor: { x: 7, y: 8 } });
    channel.simulateJoin("peer-C");

    assert.strictEqual(canvas.setCalls.length, 1);
    assert.strictEqual(canvas.setCalls[0].label, "Cara");
  });

  test("onPeerLeft removes that peer's cursor from the overlay", () => {
    const channel = createMockChannel();
    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    channel.simulateLeave("peer-B");

    assert.deepStrictEqual(canvas.removedPeers, ["peer-B"]);
  });

  test("a custom getLabel option overrides the default identity.username lookup", () => {
    const channel = createMockChannel();
    channel.addPeer("peer-B", { displayName: "Bobby" });

    const canvas = createMockCanvas();
    const session = new PixelCursorSession({
      channel,
      getLabel: (identity) => identity.displayName as string
    });
    session.attach(asHost(canvas));

    channel.simulatePresence("peer-B", { cursor: { x: 0, y: 0 } });

    assert.strictEqual(canvas.setCalls[0].label, "Bobby");
  });
});

// ---------------------------------------------------------------------------
// Chaining existing channel callbacks
// ---------------------------------------------------------------------------

describe("PixelCursorSession — chains existing channel callbacks", () => {
  test("preserves onPeerJoined/onPeerLeft/onPeerPresence set before construction", () => {
    const channel = createMockChannel();
    const seenJoins: string[] = [];
    const seenLeaves: string[] = [];
    const seenPresence: string[] = [];
    channel.onPeerJoined = (id) => seenJoins.push(id);
    channel.onPeerLeft = (id) => seenLeaves.push(id);
    channel.onPeerPresence = (id) => seenPresence.push(id);

    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    channel.addPeer("peer-B");
    channel.simulateJoin("peer-B");
    channel.simulateLeave("peer-B");
    channel.simulatePresence("peer-B", { cursor: null });

    assert.deepStrictEqual(seenJoins, ["peer-B"]);
    assert.deepStrictEqual(seenLeaves, ["peer-B"]);
    assert.deepStrictEqual(seenPresence, ["peer-B"]);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("PixelCursorSession — destroy", () => {
  test("restores the channel's previous callbacks and detaches the canvas", () => {
    const channel = createMockChannel();
    const originalJoins: string[] = [];
    function originalOnPeerJoined(clientId: string): void {
      originalJoins.push(clientId);
    }
    channel.onPeerJoined = originalOnPeerJoined;

    const canvas = createMockCanvas();
    const session = new PixelCursorSession({ channel });
    session.attach(asHost(canvas));

    session.destroy();

    assert.strictEqual(channel.onPeerJoined, originalOnPeerJoined);
    assert.strictEqual(canvas.onCursorMove, undefined);
  });
});
