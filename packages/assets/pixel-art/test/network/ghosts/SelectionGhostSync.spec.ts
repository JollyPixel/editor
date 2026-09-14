// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  PeerFloatingSelectionState,
  PeerSelectionOutlineState,
  SelectionProgressEvent,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { SelectionGhostSync } from "#src/network/ghosts/SelectionGhostSync.ts";
import type { SelectionGhostPayload } from "#src/network/types.ts";
import {
  command,
  gray,
  wholeCanvasCommands
} from "../../fixtures/commands.ts";
import { asCanvas } from "../../helpers/canvas.ts";
import { MockEmitter } from "../../helpers/emitter.ts";
import {
  callsOf,
  nextFrame
} from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

type SelectionEvents = {
  "selection-progress": (event: SelectionProgressEvent) => void;
  "selection-committed": () => void;
  "selection-idle": () => void;
};

// CONSTANTS
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

function createOverlay<TState>() {
  return {
    set: mock.fn<(clientId: string, state: TState) => void>(),
    remove: mock.fn<(clientId: string) => void>(),
    clearAll: mock.fn<() => void>(),
    removeOverlapping: mock.fn<(positions: Vec2[]) => void>()
  };
}

function setup() {
  const room = new MockRoom();
  const host = {
    selectionEvents: new MockEmitter<SelectionEvents>(),
    peerPresence: {
      selectionOutlines: createOverlay<PeerSelectionOutlineState>(),
      floatingSelections: createOverlay<PeerFloatingSelectionState>()
    }
  };
  const sync = new SelectionGhostSync({ room });
  sync.attach(asCanvas(host));

  return {
    room,
    events: host.selectionEvents,
    outlines: host.peerPresence.selectionOutlines,
    floating: host.peerPresence.floatingSelections
  };
}

describe("SelectionGhostSync — local selection", () => {
  test("reports selection progress as selectionGhost presence", async() => {
    const { room, events } = setup();

    events.emit("selection-progress", kMoving);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ selectionGhost: kMoving }]);
  });

  test("selection-committed cancels the pending report", async() => {
    const { room, events } = setup();

    events.emit("selection-progress", kMoving);
    events.emit("selection-committed");
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });

  test("selection-idle cancels the pending report and clears presence immediately", async() => {
    const { room, events } = setup();

    events.emit("selection-progress", kCreating);
    events.emit("selection-idle");
    assert.deepStrictEqual(room.presenceUpdates, [{ selectionGhost: null }]);

    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ selectionGhost: null }]);
  });
});

describe("SelectionGhostSync — remote peers", () => {
  test("a creating ghost sets the outline and removes the floating selection", () => {
    const { room, outlines, floating } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { selectionGhost: kCreating } });

    const [[clientId, state]] = callsOf(outlines.set);
    assert.strictEqual(clientId, "peer-B");
    assert.deepStrictEqual(state.rect, kCreating.rect);
    assert.strictEqual(state.mask, null);
    assert.ok(state.color.length > 0);
    assert.deepStrictEqual(callsOf(floating.remove), [["peer-B"]]);
  });

  test("a moving ghost sets both the outline and the floating selection", () => {
    const { room, outlines, floating } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { selectionGhost: kMoving } });

    const [[, outline]] = callsOf(outlines.set);
    assert.deepStrictEqual(outline.rect, kMoving.liveRect);
    assert.deepStrictEqual(outline.mask, kMoving.mask);
    assert.deepStrictEqual(callsOf(floating.set), [["peer-B", {
      sourceRect: kMoving.sourceRect,
      liveRect: kMoving.liveRect,
      mask: kMoving.mask,
      blankSource: kMoving.blankSource
    }]]);
  });

  test("a null selectionGhost and a leaving peer clear both overlays", () => {
    const { room, outlines, floating } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { selectionGhost: null } });
    room.emit("peer-left", { clientId: "peer-C" });

    assert.deepStrictEqual(callsOf(outlines.remove), [["peer-B"], ["peer-C"]]);
    assert.deepStrictEqual(callsOf(floating.remove), [["peer-B"], ["peer-C"]]);
  });

  test("ignores a malformed selectionGhost payload", () => {
    const { room, outlines } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { selectionGhost: "not-an-object" } });
    room.emit("peer-presence", { clientId: "peer-B", patch: { selectionGhost: { phase: "unknown" } } });

    assert.strictEqual(outlines.set.mock.callCount(), 0);
  });
});

describe("SelectionGhostSync — reconciliation", () => {
  test("a select-edit command removes overlapping ghosts from both overlays", () => {
    const { room, outlines, floating } = setup();
    const positions = [{ x: 0, y: 0 }, { x: 1, y: 1 }];

    room.deliverCommand(command("select-edit", {
      positions,
      colors: [gray(0), gray(0)]
    }, { clientId: "peer-B" }));

    assert.deepStrictEqual(callsOf(outlines.removeOverlapping), [[positions]]);
    assert.deepStrictEqual(callsOf(floating.removeOverlapping), [[positions]]);
    assert.strictEqual(outlines.remove.mock.callCount(), 0);
  });

  test("whole-canvas commands and snapshots clear both overlays", () => {
    const { room, outlines, floating } = setup();

    for (const received of wholeCanvasCommands()) {
      room.deliverCommand(received);
    }
    room.deliverSnapshot();

    assert.strictEqual(outlines.clearAll.mock.callCount(), 4);
    assert.strictEqual(floating.clearAll.mock.callCount(), 4);
  });
});
