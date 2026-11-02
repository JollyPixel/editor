// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import { StandalonePixelHistory } from "#src/history/PixelCanvasHistory.ts";
import { pixelArtAssetKind } from "#src/index.ts";
import { PixelSyncClient } from "#src/network/sync/PixelSyncClient.ts";
import type { PixelWireSnapshot } from "#src/network/protocol/types.ts";
import { command } from "../fixtures/commands.ts";
import { readPixel } from "../fixtures/canvas.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { mouseEvent } from "../helpers/events.ts";
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

async function setup(
  history = false
) {
  const server = new LiveAssetRoom(
    pixelArtAssetKind({ defaultSize: { x: 8, y: 8 } })
  );
  const room = new MockRoom({ clientId: "B" });
  const { manager, canvas } = createPixelArtCanvas({
    zoom: { default: 4 },
    brush: { size: 1, maxSize: 1 },
    history: history ? new StandalonePixelHistory() : undefined
  });
  new PixelSyncClient({ room, document: manager.document });

  function deliver(): void {
    for (const message of server.take<PixelWireSnapshot>("B")) {
      room.emit("message", message);
    }
  }

  async function flush(): Promise<void> {
    for (const sent of room.sent.splice(0)) {
      await server.receive("B", sent);
    }
  }

  await server.connect("B");
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
  test("C1: the author keeps its newer stroke when an older peer stroke lands first", async(t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { server, manager, deliver, flush, paintPixelOneOne } = await setup();

    t.mock.timers.tick(200);
    paintPixelOneOne();
    await server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", timestamp: 100 }));
    await flush();
    deliver();

    assert.deepStrictEqual(server.state.document.buffer.samplePixel(1, 1), kBlack);
    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kBlack);
    manager.destroy();
  });

  test("a client whose clock is two minutes slow wins the stroke it sent last", async(t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    const { server, manager, deliver, flush, paintPixelOneOne } = await setup();
    await server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 2, y: 2 }]
    }, { clientId: "A", timestamp: 1_000_000 }));
    deliver();

    t.mock.timers.setTime(1_000_000 - 120_000);
    paintPixelOneOne();
    t.mock.timers.setTime(1_000_000);
    await server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", timestamp: 1_000_000 }));
    await flush();
    deliver();

    assert.deepStrictEqual(server.state.document.buffer.samplePixel(1, 1), kBlack);
    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kBlack);
    manager.destroy();
  });

  test("an undo sends the version of the stroke it replays as its basis", async(t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 100 });
    const { manager, room, deliver, flush, paintPixelOneOne } = await setup(true);

    paintPixelOneOne();
    await flush();
    deliver();
    manager.undo();

    assert.strictEqual(room.sent.at(-1)?.basis, 1);
    manager.destroy();
  });

  test("a peer stroke after the author's echo shows on the author", async(t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 100 });
    const { server, manager, deliver, flush, paintPixelOneOne } = await setup();

    paintPixelOneOne();
    await flush();
    await server.receive("A", command("stroke", {
      color: kBlue,
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", timestamp: 1 }));
    deliver();

    assert.deepStrictEqual(server.state.document.buffer.samplePixel(1, 1), kBlueBytes);
    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kBlueBytes);
    manager.destroy();
  });
});
