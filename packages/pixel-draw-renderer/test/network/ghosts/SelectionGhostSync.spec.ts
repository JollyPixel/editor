// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { SelectionGhostSync } from "#src/network/ghosts/SelectionGhostSync.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage,
  SelectionGhostPayload
} from "#src/network/types.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { SelectionProgressEvent } from "#src/tools/SelectEngine.events.ts";
import type { PeerSelectionOutlineState } from "#src/rendering/presence/PeerSelectionOutlines.ts";
import type { PeerFloatingSelectionState } from "#src/rendering/presence/PeerFloatingSelections.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRoom extends network.Room<PixelNetworkCommand, PixelServerMessage> {
  presenceUpdates: network.PeerMetadata[];
  addPeer(clientId: string, presence: network.PeerMetadata): void;
  simulateLeave(clientId: string): void;
  simulatePresence(clientId: string, patch: network.PeerMetadata): void;
  simulateSelectEditCommand(positions: { x: number; y: number; }[]): void;
  simulateResizedCommand(): void;
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
      // Unused by SelectionGhostSync.
    },
    send() {
      // Unused by SelectionGhostSync.
    },
    updatePresence(patch) {
      presenceUpdates.push(patch);
    },
    leave() {
      // Unused by SelectionGhostSync.
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
    simulateSelectEditCommand(positions) {
      emit("message", {
        type: "command",
        data: { clientId: "peer-B", action: "select-edit", metadata: { positions, colors: [] } }
      });
    },
    simulateResizedCommand() {
      emit("message", {
        type: "command",
        data: { clientId: "peer-B", action: "resized", metadata: {} }
      });
    },
    simulateSnapshot() {
      emit("message", { type: "snapshot", data: {} });
    }
  };

  return room;
}

interface MockSelectEngine {
  on(type: string, listener: (event: any) => void): void;
  off(type: string, listener: (event: any) => void): void;
  simulateProgress(event: SelectionProgressEvent): void;
  simulateCommitted(): void;
  simulateIdle(): void;
}

function createMockSelectEngine(): MockSelectEngine {
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
    simulateProgress(event) {
      emit("selection-progress", event);
    },
    simulateCommitted() {
      emit("selection-committed", undefined);
    },
    simulateIdle() {
      emit("selection-idle", undefined);
    }
  };
}

interface MockCanvas {
  selectionEvents: MockSelectEngine;
  selectionSetCalls: { clientId: string; state: PeerSelectionOutlineState; }[];
  selectionRemovedPeers: string[];
  selectionClearAllCallCount: number;
  selectionRemoveOverlappingCalls: { x: number; y: number; }[][];
  floatingSetCalls: { clientId: string; state: PeerFloatingSelectionState; }[];
  floatingRemovedPeers: string[];
  floatingClearAllCallCount: number;
  floatingRemoveOverlappingCalls: { x: number; y: number; }[][];
  peerPresence: {
    selectionOutlines: {
      set(clientId: string, state: PeerSelectionOutlineState): void;
      remove(clientId: string): void;
      clearAll(): void;
      removeOverlapping(positions: { x: number; y: number; }[]): void;
    };
    floatingSelections: {
      set(clientId: string, state: PeerFloatingSelectionState): void;
      remove(clientId: string): void;
      clearAll(): void;
      removeOverlapping(positions: { x: number; y: number; }[]): void;
    };
  };
}

function createMockCanvas(): MockCanvas {
  const selectionSetCalls: MockCanvas["selectionSetCalls"] = [];
  const selectionRemovedPeers: string[] = [];
  const selectionRemoveOverlappingCalls: MockCanvas["selectionRemoveOverlappingCalls"] = [];
  const floatingSetCalls: MockCanvas["floatingSetCalls"] = [];
  const floatingRemovedPeers: string[] = [];
  const floatingRemoveOverlappingCalls: MockCanvas["floatingRemoveOverlappingCalls"] = [];

  const canvas: MockCanvas = {
    selectionEvents: createMockSelectEngine(),
    selectionSetCalls,
    selectionRemovedPeers,
    selectionClearAllCallCount: 0,
    selectionRemoveOverlappingCalls,
    floatingSetCalls,
    floatingRemovedPeers,
    floatingClearAllCallCount: 0,
    floatingRemoveOverlappingCalls,
    peerPresence: {
      selectionOutlines: {
        set(clientId, state) {
          selectionSetCalls.push({ clientId, state });
        },
        remove(clientId) {
          selectionRemovedPeers.push(clientId);
        },
        clearAll() {
          canvas.selectionClearAllCallCount++;
        },
        removeOverlapping(positions) {
          selectionRemoveOverlappingCalls.push(positions);
        }
      },
      floatingSelections: {
        set(clientId, state) {
          floatingSetCalls.push({ clientId, state });
        },
        remove(clientId) {
          floatingRemovedPeers.push(clientId);
        },
        clearAll() {
          canvas.floatingClearAllCallCount++;
        },
        removeOverlapping(positions) {
          floatingRemoveOverlappingCalls.push(positions);
        }
      }
    }
  };

  return canvas;
}

// SelectionGhostSync is typed against the concrete PixelArtCanvas, but only
// uses the structural subset MockCanvas implements.
function asHost(
  canvas: MockCanvas
): PixelArtCanvas {
  return canvas as unknown as PixelArtCanvas;
}

const kCreating: SelectionProgressEvent = {
  phase: "creating",
  rect: { x: 0, y: 0, width: 4, height: 4 }
};
const kMoving: SelectionGhostPayload = {
  phase: "moving",
  sourceRect: { x: 0, y: 0, width: 2, height: 2 },
  liveRect: { x: 5, y: 5, width: 2, height: 2 },
  mask: [true, true, true, true],
  blankSource: true
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("SelectionGhostSync — attach", () => {
  test("throws when a canvas is already attached", () => {
    const sync = new SelectionGhostSync({ room: createMockRoom() });
    sync.attach(asHost(createMockCanvas()));

    assert.throws(() => sync.attach(asHost(createMockCanvas())));
  });

  test("seeds ghost presence already stored on the room", () => {
    const room = createMockRoom();
    room.addPeer("peer-B", { selectionGhost: kCreating });
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });

    sync.attach(asHost(canvas));

    assert.strictEqual(canvas.selectionSetCalls.length, 1);
    assert.strictEqual(
      canvas.selectionSetCalls[0].clientId,
      "peer-B"
    );
  });

  test("enableGhostPreview: false never wires the selection-progress listener", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room, enableGhostPreview: false });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kCreating);
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

describe("SelectionGhostSync — detach", () => {
  test("stops forwarding local progress", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    sync.detach();
    canvas.selectionEvents.simulateProgress(kCreating);
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Local progress -> presence (rAF-gated)
// ---------------------------------------------------------------------------

describe("SelectionGhostSync — local progress reporting", () => {
  test("forwards a local creating-phase event as a presence update on the next frame", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kCreating);
    assert.strictEqual(room.presenceUpdates.length, 0, "not sent synchronously");

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1);
    assert.deepStrictEqual(room.presenceUpdates[0], { selectionGhost: kCreating });
  });

  test("forwards a local moving-phase event as-is", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kMoving);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates[0], { selectionGhost: kMoving });
  });

  test("coalesces multiple updates within the same frame into a single send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kCreating);
    canvas.selectionEvents.simulateProgress({ ...kCreating, rect: { x: 1, y: 1, width: 5, height: 5 } });

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1, "only the latest snapshot is sent");
  });

  test("selection-committed cancels a queued pre-commit send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kMoving);
    canvas.selectionEvents.simulateCommitted();

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 0);
  });

  test("selection-idle cancels a queued pre-commit send and immediately clears presence", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kCreating);
    canvas.selectionEvents.simulateIdle();

    // The clear is sent synchronously, not batched via rAF.
    assert.strictEqual(room.presenceUpdates.length, 1);
    assert.deepStrictEqual(room.presenceUpdates[0], { selectionGhost: null });

    await nextFrame();
    assert.strictEqual(room.presenceUpdates.length, 1, "the cancelled pending tick never sent");
  });
});

// ---------------------------------------------------------------------------
// Remote peers -> overlays
// ---------------------------------------------------------------------------

describe("SelectionGhostSync — remote peers", () => {
  test("a creating-phase presence patch sets the border overlay and clears any stale floating ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { selectionGhost: kCreating });

    assert.strictEqual(canvas.selectionSetCalls.length, 1);
    assert.strictEqual(canvas.selectionSetCalls[0].clientId, "peer-B");
    assert.deepStrictEqual(canvas.selectionSetCalls[0].state.rect, kCreating.rect);
    assert.strictEqual(canvas.selectionSetCalls[0].state.mask, null);
    assert.ok(canvas.selectionSetCalls[0].state.color.length > 0, "a peer color was hashed in");
    assert.deepStrictEqual(canvas.floatingRemovedPeers, ["peer-B"]);
  });

  test("a moving-phase presence patch sets both the border and the floating overlay", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { selectionGhost: kMoving });

    assert.strictEqual(canvas.selectionSetCalls.length, 1);
    assert.deepStrictEqual(canvas.selectionSetCalls[0].state.rect, kMoving.liveRect);
    assert.deepStrictEqual(canvas.selectionSetCalls[0].state.mask, kMoving.mask);

    assert.strictEqual(canvas.floatingSetCalls.length, 1);
    assert.deepStrictEqual(canvas.floatingSetCalls[0].state, {
      sourceRect: kMoving.sourceRect,
      liveRect: kMoving.liveRect,
      mask: kMoving.mask,
      blankSource: kMoving.blankSource
    });
  });

  test("expires both peer ghost overlays from one lease", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { selectionGhost: kMoving });
    t.mock.timers.tick(1499);
    assert.deepStrictEqual(canvas.selectionRemovedPeers, []);
    assert.deepStrictEqual(canvas.floatingRemovedPeers, []);

    t.mock.timers.tick(1);
    assert.deepStrictEqual(canvas.selectionRemovedPeers, ["peer-B"]);
    assert.deepStrictEqual(canvas.floatingRemovedPeers, ["peer-B"]);
  });

  test("an explicit null payload clears both overlays for that peer", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { selectionGhost: null });

    assert.deepStrictEqual(canvas.selectionRemovedPeers, ["peer-B"]);
    assert.deepStrictEqual(canvas.floatingRemovedPeers, ["peer-B"]);
  });

  test("ignores presence patches that don't touch the selectionGhost field", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { somethingElse: true });

    assert.strictEqual(canvas.selectionSetCalls.length, 0);
  });

  test("ignores a malformed selectionGhost payload", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulatePresence("peer-B", { selectionGhost: "not-an-object" });
    room.simulatePresence("peer-B", { selectionGhost: { phase: "unknown" } });

    assert.strictEqual(canvas.selectionSetCalls.length, 0);
  });

  test("onPeerLeft removes that peer's ghost from both overlays", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateLeave("peer-B");

    assert.deepStrictEqual(canvas.selectionRemovedPeers, ["peer-B"]);
    assert.deepStrictEqual(canvas.floatingRemovedPeers, ["peer-B"]);
  });
});

// ---------------------------------------------------------------------------
// Reconciliation with the authoritative pipeline
// ---------------------------------------------------------------------------

describe("SelectionGhostSync — reconciliation", () => {
  test("an incoming select-edit command clears both overlays by content, not by clientId", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    const positions = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    room.simulateSelectEditCommand(positions);

    assert.deepStrictEqual(canvas.selectionRemoveOverlappingCalls, [positions]);
    assert.deepStrictEqual(canvas.floatingRemoveOverlappingCalls, [positions]);
    assert.strictEqual(canvas.selectionRemovedPeers.length, 0, "no longer matches by clientId");
  });

  test("a whole-canvas command (e.g. resized) clears every ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateResizedCommand();

    assert.strictEqual(canvas.selectionClearAllCallCount, 1);
    assert.strictEqual(canvas.floatingClearAllCallCount, 1);
  });

  test("an incoming snapshot clears every peer's ghost", () => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    room.simulateSnapshot();

    assert.strictEqual(canvas.selectionClearAllCallCount, 1);
    assert.strictEqual(canvas.floatingClearAllCallCount, 1);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("SelectionGhostSync — destroy", () => {
  test("removes only its own listeners and detaches the canvas", () => {
    const room = createMockRoom();
    const otherLeaves: string[] = [];
    room.on("peer-left", (event) => otherLeaves.push(event.clientId));

    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    sync.destroy();
    room.simulateLeave("peer-B");

    assert.deepStrictEqual(otherLeaves, ["peer-B"]);
    assert.strictEqual(canvas.selectionRemovedPeers.length, 0);
  });

  test("cancels a pending rAF-scheduled send", async() => {
    const room = createMockRoom();
    const canvas = createMockCanvas();
    const sync = new SelectionGhostSync({ room });
    sync.attach(asHost(canvas));

    canvas.selectionEvents.simulateProgress(kCreating);
    sync.destroy();
    await nextFrame();

    assert.strictEqual(room.presenceUpdates.length, 0);
  });
});
