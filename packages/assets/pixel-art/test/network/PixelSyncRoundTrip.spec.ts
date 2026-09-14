// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import { PixelSyncServer } from "#src/network/PixelSyncServer.ts";
import { command } from "../fixtures/commands.ts";
import { readPixel } from "../fixtures/canvas.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import {
  deleteKey,
  mouseEvent
} from "../helpers/events.ts";
import { MockRoom } from "../helpers/room.ts";
import { createRoomContext } from "../helpers/roomContext.ts";

// CONSTANTS
const kWhite = [255, 255, 255, 255];
const kBlack = [0, 0, 0, 255];
const kBlue = [0, 0, 255, 255];

function setup() {
  const server = new PixelSyncServer({
    buffer: new PixelBuffer({ size: { x: 8, y: 8 } })
  });
  const { context } = createRoomContext();
  const room = new MockRoom({
    clientId: "A",
    onSend: (sent) => server.receive(sent, context)
  });
  const { manager, canvas } = createPixelArtCanvas({
    zoom: { default: 4 },
    brush: { size: 1, maxSize: 1 },
    history: { enabled: true }
  });
  new PixelSyncClient({ room }).attach(manager);
  room.deliverSnapshot(server.snapshot());

  function paintPixelOneOne(): void {
    canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }

  return {
    server,
    context,
    room,
    manager,
    canvas,
    paintPixelOneOne
  };
}

describe("PixelSyncClient and PixelSyncServer — undo", () => {
  test("an undo replays with the original stroke's timestamp", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { room, manager, paintPixelOneOne } = setup();

    t.mock.timers.tick(1000);
    paintPixelOneOne();
    t.mock.timers.tick(2000);
    manager.undo();

    assert.strictEqual(room.sent.at(-1)?.action, "stroke");
    assert.strictEqual(room.sent.at(-1)?.timestamp, 1000);
    manager.destroy();
  });

  test("a peer's newer edit survives an undo of an older stroke", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { server, context, manager, paintPixelOneOne } = setup();

    t.mock.timers.tick(1000);
    paintPixelOneOne();
    assert.deepStrictEqual(server.buffer.samplePixel(1, 1), kBlack);
    server.receive(command("stroke", {
      color: { r: 0, g: 0, b: 255, a: 255 },
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "B", timestamp: 2000 }), context);
    t.mock.timers.tick(2000);
    manager.undo();

    assert.deepStrictEqual(server.buffer.samplePixel(1, 1), kBlue);
    manager.destroy();
  });

  test("undoing two overlapping strokes reverts the shared pixel on the server", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { server, manager, paintPixelOneOne } = setup();

    t.mock.timers.tick(1000);
    paintPixelOneOne();
    t.mock.timers.tick(1000);
    paintPixelOneOne();
    assert.deepStrictEqual(server.buffer.samplePixel(1, 1), kBlack);

    t.mock.timers.tick(1000);
    manager.undo();
    manager.undo();

    assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), kWhite);
    assert.deepStrictEqual(server.buffer.samplePixel(1, 1), kWhite);
    manager.destroy();
  });

  test("a select-edit and its undo both reach the server", () => {
    const { server, manager, canvas } = setup();
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    window.dispatchEvent(deleteKey());
    assert.deepStrictEqual(server.buffer.samplePixel(2, 2), kWhite);

    manager.undo();

    assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), kBlack);
    assert.deepStrictEqual(server.buffer.samplePixel(2, 2), kBlack);
    manager.destroy();
  });
});
