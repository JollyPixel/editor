// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pixelArtAssetKind } from "#src/index.ts";
import type { PixelArtState } from "#src/asset/pixelArtAssetKind.ts";
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import type {
  PixelServerMessage,
  PixelWireCommand
} from "#src/network/types.ts";
import { command } from "../fixtures/commands.ts";
import { readPixel } from "../fixtures/canvas.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { mouseEvent } from "../helpers/events.ts";
import { LiveRoom } from "../helpers/liveRoom.ts";
import { MockRoom } from "../helpers/room.ts";

// CONSTANTS
const kBlack = [0, 0, 0, 255];
const kBlueBytes = [0, 0, 255, 255];
const kBlue = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};

function setup(
  history = false
) {
  const server = new LiveRoom<PixelArtState, PixelWireCommand>(
    pixelArtAssetKind({ defaultSize: { x: 8, y: 8 } })
  );
  const room = new MockRoom({ clientId: "B" });
  const { manager, canvas } = createPixelArtCanvas({
    zoom: { default: 4 },
    brush: { size: 1, maxSize: 1 },
    history: { enabled: history }
  });
  new PixelSyncClient({ room, document: manager.document });

  function deliver(): void {
    for (const message of server.take("B")) {
      room.emit("message", message as PixelServerMessage);
    }
  }

  function flush(): void {
    for (const sent of room.sent.splice(0)) {
      server.receive("B", sent);
    }
  }

  server.connect("B");
  deliver();

  return {
    server,
    room,
    manager,
    deliver,
    flush,
    paintPixelOneOne(): void {
      canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }
  };
}

describe("pixel-art convergence", () => {
  test("C1: the author keeps its newer stroke when an older peer stroke lands first", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { server, manager, deliver, flush, paintPixelOneOne } = setup();

    t.mock.timers.tick(200);
    paintPixelOneOne();
    server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", timestamp: 100 }));
    flush();
    deliver();

    assert.deepStrictEqual(server.state.document.buffer.samplePixel(1, 1), kBlack);
    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kBlack);
    manager.destroy();
  });

  test("a client whose clock is two minutes slow wins the stroke it sent last", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    const { server, manager, deliver, flush, paintPixelOneOne } = setup();
    server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 2, y: 2 }]
    }, { clientId: "A", timestamp: 1_000_000 }));
    deliver();

    t.mock.timers.setTime(1_000_000 - 120_000);
    paintPixelOneOne();
    t.mock.timers.setTime(1_000_000);
    server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", timestamp: 1_000_000 }));
    flush();
    deliver();

    assert.deepStrictEqual(server.state.document.buffer.samplePixel(1, 1), kBlack);
    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kBlack);
    manager.destroy();
  });

  test("an undo sends the version of the stroke it replays as its basis", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 100 });
    const { manager, room, deliver, flush, paintPixelOneOne } = setup(true);

    paintPixelOneOne();
    flush();
    deliver();
    manager.undo();

    assert.strictEqual(room.sent.at(-1)?.basis, 1);
    manager.destroy();
  });

  test("a peer stroke after the author's echo shows on the author", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 100 });
    const { server, manager, deliver, flush, paintPixelOneOne } = setup();

    paintPixelOneOne();
    flush();
    server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", timestamp: 1 }));
    deliver();

    assert.deepStrictEqual(server.state.document.buffer.samplePixel(1, 1), kBlueBytes);
    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kBlueBytes);
    manager.destroy();
  });
});
