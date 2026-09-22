// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { encodePixelBytes } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  SyncedPixelDocument,
  pixelArtDocumentKind
} from "#src/network/SyncedPixelDocument.ts";
import { command } from "../fixtures/commands.ts";
import { MockRoom } from "../helpers/room.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

function snapshotOf(
  size: { x: number; y: number; }
) {
  return {
    size,
    pixels: encodePixelBytes(new Uint8ClampedArray(size.x * size.y * 4)),
    uvRegions: []
  };
}

describe("SyncedPixelDocument", () => {
  test("is ready once the first snapshot is loaded into the document", async() => {
    const room = new MockRoom({ clientId: "client-A" });
    const synced = new SyncedPixelDocument(room);
    let settled = false;
    void synced.ready.then(() => {
      settled = true;
    });

    await Promise.resolve();
    assert.strictEqual(settled, false);

    room.deliverSnapshot(snapshotOf({ x: 4, y: 2 }));
    await synced.ready;

    assert.deepStrictEqual(synced.document.size(), { x: 4, y: 2 });
    synced.dispose();
  });

  test("sends local document edits without any canvas", () => {
    const room = new MockRoom({ clientId: "client-A" });
    const synced = new SyncedPixelDocument(room, {
      history: { enabled: true }
    });
    room.deliverSnapshot(snapshotOf({ x: 4, y: 4 }));

    synced.document.commitPixels([{ x: 1, y: 1 }], kRed);

    assert.deepStrictEqual(room.sent.map((sent) => sent.action), ["stroke"]);
    assert.strictEqual(synced.document.history.canUndo, true);
    synced.dispose();
  });

  test("applies peer commands to the document", () => {
    const room = new MockRoom({ clientId: "client-A" });
    const synced = new SyncedPixelDocument(room);
    room.deliverSnapshot(snapshotOf({ x: 4, y: 4 }));

    room.deliverCommand(command(
      "stroke",
      { color: kRed, positions: [{ x: 2, y: 2 }] },
      { clientId: "peer-B" }
    ));

    assert.deepStrictEqual(
      [...synced.document.buffer.samplePixel(2, 2)],
      [255, 0, 0, 255]
    );
    synced.dispose();
  });

  test("dispose stops sending and applying", () => {
    const room = new MockRoom({ clientId: "client-A" });
    const synced = new SyncedPixelDocument(room);
    room.deliverSnapshot(snapshotOf({ x: 4, y: 4 }));

    synced.dispose();
    synced.document.commitPixels([{ x: 0, y: 0 }], kRed);
    room.deliverSnapshot(snapshotOf({ x: 8, y: 8 }));

    assert.deepStrictEqual(room.sent, []);
    assert.deepStrictEqual(synced.document.size(), { x: 4, y: 4 });
  });
});

describe("pixelArtDocumentKind", () => {
  test("names the pixel-art kind and builds a synced document per room", () => {
    const kind = pixelArtDocumentKind({ maxSize: 64 });
    const room = new MockRoom();

    const synced = kind.createDocument(room);

    assert.strictEqual(kind.kind, "pixelart");
    assert.ok(synced instanceof SyncedPixelDocument);
    assert.strictEqual(synced.document.buffer.maxSize, 64);
    synced.dispose();
  });
});
