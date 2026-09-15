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
const kPixel: PeerStrokePixel = {
  x: 1,
  y: 2,
  color: { r: 255, g: 0, b: 0, a: 255 }
};

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

  test("reports stroke progress as strokeGhost presence", async() => {
    const { room, host } = setup();

    host.onStrokeProgress?.([kPixel]);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, [{ strokeGhost: [kPixel] }]);
  });

  test("an empty stroke progress cancels the pending report", async() => {
    const { room, host } = setup();

    host.onStrokeProgress?.([kPixel]);
    host.onStrokeProgress?.([]);
    await nextFrame();

    assert.deepStrictEqual(room.presenceUpdates, []);
  });
});

describe("PixelStrokeGhostSync — remote peers", () => {
  test("draws a peer strokeGhost on the stroke overlay", () => {
    const { room, strokes } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { strokeGhost: [kPixel] } });

    assert.deepStrictEqual(callsOf(strokes.set), [["peer-B", [kPixel]]]);
  });

  test("ignores a malformed strokeGhost payload", () => {
    const { room, strokes } = setup();

    room.emit("peer-presence", { clientId: "peer-B", patch: { strokeGhost: "not-an-array" } });
    room.emit("peer-presence", { clientId: "peer-B", patch: { strokeGhost: [{ x: 1 }] } });

    assert.strictEqual(strokes.set.mock.callCount(), 0);
  });

  test("removes a leaving peer's ghost and clears all ghosts on snapshot", () => {
    const { room, strokes } = setup();
    room.emit("peer-presence", { clientId: "peer-B", patch: { strokeGhost: [kPixel] } });

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
