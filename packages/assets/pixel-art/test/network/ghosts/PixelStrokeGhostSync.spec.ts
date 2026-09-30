// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  PeerStrokePixel,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelStrokeGhostSync } from "#src/network/ghosts/PixelStrokeGhostSync.ts";
import {
  command,
  gray,
  wholeCanvasCommands
} from "../../fixtures/commands.ts";
import { asCanvas } from "../../helpers/canvas.ts";
import {
  callsOf,
  nextFrame
} from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

type StrokeListener = (pixels: PeerStrokePixel[]) => void;

// CONSTANTS
const kRed = { r: 255, g: 0, b: 0, a: 255 };
const kPixel: PeerStrokePixel = {
  x: 1,
  y: 2,
  color: kRed
};

function redPixel(
  x: number,
  y = 0
): PeerStrokePixel {
  return {
    x,
    y,
    color: kRed
  };
}

function createHost() {
  return {
    onStrokeProgress: undefined as StrokeListener | undefined,
    peerPresence: {
      strokes: {
        set: mock.fn<(clientId: string, pixels: PeerStrokePixel[]) => void>(),
        remove: mock.fn<(clientId: string) => void>(),
        clearAll: mock.fn<() => void>(),
        removeOverlapping: mock.fn<(positions: Vec2[]) => void>()
      }
    }
  };
}

function setup() {
  const room = new MockRoom();
  const host = createHost();
  const sync = new PixelStrokeGhostSync({
    room,
    canvas: asCanvas(host)
  });

  return {
    room,
    host,
    strokes: host.peerPresence.strokes,
    sync
  };
}

describe("PixelStrokeGhostSync — local strokes", () => {
  test("chains the existing onStrokeProgress listener and restores it on destroy", () => {
    const host = createHost();
    const previous = mock.fn<StrokeListener>();
    host.onStrokeProgress = previous;
    const sync = new PixelStrokeGhostSync({
      room: new MockRoom(),
      canvas: asCanvas(host)
    });

    host.onStrokeProgress?.([kPixel]);
    sync.destroy();

    assert.deepStrictEqual(callsOf(previous), [[[kPixel]]]);
    assert.strictEqual(host.onStrokeProgress, previous);
  });

  test("reports stroke progress as a strokeGhost frame", async() => {
    const { room, host } = setup();

    host.onStrokeProgress?.([kPixel]);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{
      strokeGhost: { from: 0, spans: [{ color: kRed, xy: [1, 2] }] }
    }]);
  });

  test("sends only the pixels added since the previous frame", async() => {
    const { room, host } = setup();

    host.onStrokeProgress?.([redPixel(0)]);
    await nextFrame();
    host.onStrokeProgress?.([redPixel(0), redPixel(1)]);
    host.onStrokeProgress?.([redPixel(0), redPixel(1), redPixel(2)]);
    await nextFrame();
    host.onStrokeProgress?.([redPixel(0), redPixel(1), redPixel(2)]);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [
      { strokeGhost: { from: 0, spans: [{ color: kRed, xy: [0, 0] }] } },
      {
        strokeGhost: {
          from: 1,
          spans: [
            { color: kRed, xy: [1, 0] },
            { color: kRed, xy: [2, 0] }
          ]
        }
      }
    ]);
  });

  test("resends the whole stroke once it no longer extends the previous one", async() => {
    const { room, host } = setup();

    host.onStrokeProgress?.([redPixel(0), redPixel(1)]);
    await nextFrame();
    host.onStrokeProgress?.([redPixel(0), redPixel(2)]);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates.at(-1), {
      strokeGhost: { from: 0, spans: [{ color: kRed, xy: [0, 0, 2, 0] }] }
    });
  });

  test("an empty stroke progress drops the pending report and clears the ghost", async() => {
    const { room, host } = setup();

    host.onStrokeProgress?.([kPixel]);
    host.onStrokeProgress?.([]);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ strokeGhost: null }]);
  });
});

describe("PixelStrokeGhostSync — remote peers", () => {
  test("draws a peer's frames on the stroke overlay as one growing stroke", () => {
    const { room, strokes } = setup();

    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { strokeGhost: { from: 0, spans: [{ color: kRed, xy: [0, 0] }] } }
    });
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { strokeGhost: { from: 1, spans: [{ color: kRed, xy: [1, 0] }] } }
    });

    assert.deepStrictEqual(strokes.set.mock.calls.at(-1)?.arguments, [
      "peer-B",
      [redPixel(0), redPixel(1)]
    ]);
  });

  test("restarts a peer's stroke on a frame from the first pixel", () => {
    const { room, strokes } = setup();

    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { strokeGhost: { from: 0, spans: [{ color: kRed, xy: [0, 0] }] } }
    });
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { strokeGhost: { from: 0, spans: [{ color: kRed, xy: [5, 0] }] } }
    });

    assert.deepStrictEqual(strokes.set.mock.calls.at(-1)?.arguments, [
      "peer-B",
      [redPixel(5)]
    ]);
  });

  test("draws the pixels of a frame joined mid-stroke", () => {
    const { room, strokes } = setup();

    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { strokeGhost: { from: 40, spans: [{ color: kRed, xy: [3, 0] }] } }
    });

    assert.deepStrictEqual(callsOf(strokes.set), [["peer-B", [redPixel(3)]]]);
  });

  test("ignores a malformed strokeGhost payload", () => {
    const { room, strokes } = setup();

    for (const strokeGhost of [
      [kPixel],
      { from: -1, spans: [] },
      { from: 0, spans: [{ color: kRed, xy: [1] }] },
      { from: 0, spans: [{ color: "red", xy: [1, 1] }] }
    ]) {
      room.emit("peer-presence", { clientId: "peer-B", patch: { strokeGhost } });
    }

    assert.strictEqual(strokes.set.mock.callCount(), 0);
  });

  test("removes a leaving peer's ghost and clears all ghosts on snapshot", () => {
    const { room, strokes } = setup();
    room.emit("peer-presence", {
      clientId: "peer-B",
      patch: { strokeGhost: { from: 0, spans: [{ color: kRed, xy: [1, 2] }] } }
    });

    room.emit("peer-left", { clientId: "peer-B" });
    room.deliverSnapshot();

    assert.deepStrictEqual(callsOf(strokes.remove), [["peer-B"]]);
    assert.strictEqual(strokes.clearAll.mock.callCount(), 1);
  });
});

describe("PixelStrokeGhostSync — reconciliation", () => {
  test("a stroke command removes ghosts overlapping its positions", () => {
    const { room, strokes } = setup();
    const positions = [{ x: 1, y: 2 }];

    room.deliverCommand(command("stroke", {
      color: gray(0),
      positions
    }, { clientId: "peer-B" }));

    assert.deepStrictEqual(callsOf(strokes.removeOverlapping), [[positions]]);
    assert.strictEqual(strokes.remove.mock.callCount(), 0);
  });

  test("whole-canvas commands clear every ghost", () => {
    const { room, strokes } = setup();

    for (const received of wholeCanvasCommands()) {
      room.deliverCommand(received);
    }

    assert.strictEqual(strokes.clearAll.mock.callCount(), 3);
  });
});
