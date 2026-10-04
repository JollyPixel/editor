// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import { decodePixelBytes } from "#src/serialization/pixelBytes.ts";
import {
  createDocument,
  pixelAt
} from "./helpers/document/document.ts";
import {
  addRegion,
  createNormalMapDocument,
  zoneIds
} from "./helpers/document/normalMap.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kBlue = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};

describe("PixelDocument history", () => {
  test("undo of a stroke restores each pixel's own color", () => {
    const doc = createDocument();
    doc.paintPixels([{ x: 0, y: 0 }], kRed);
    doc.paintPixels([{ x: 1, y: 0 }], kBlue);
    doc.paintPixels([{ x: 0, y: 0 }, { x: 1, y: 0 }], { ...kRed, g: 9 });

    doc.undo();

    assert.deepEqual(pixelAt(doc, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(pixelAt(doc, 1, 0), [0, 0, 255, 255]);
  });

  test("UV undo and redo emit their commands with the entry timestamp", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 42 });
    const events: PixelCommand[] = [];
    const doc = createDocument(events);
    const region = doc.uv.create({ width: 2, height: 2 });
    doc.uv.move(region.id, { x: 1, y: 1, width: 2, height: 2 });
    events.length = 0;

    doc.undo();
    doc.redo();

    assert.deepEqual(events, [
      {
        action: "uv-region-moved",
        metadata: {
          id: region.id,
          face: null,
          rect: { x: 0, y: 0, width: 2, height: 2 }
        },
        originTimestamp: 42
      },
      {
        action: "uv-region-moved",
        metadata: {
          id: region.id,
          face: null,
          rect: { x: 1, y: 1, width: 2, height: 2 }
        },
        originTimestamp: 42
      }
    ]);
  });

  test("undo of a UV creation emits a deletion with the entry timestamp", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 7 });
    const events: PixelCommand[] = [];
    const doc = createDocument(events);
    const region = doc.uv.create({ width: 2, height: 2 });
    events.length = 0;

    doc.undo();

    assert.deepEqual(events, [
      {
        action: "uv-region-deleted",
        metadata: { id: region.id },
        originTimestamp: 7
      }
    ]);
  });

  test("history-changed fires after the normal map zone of an undone deletion is back", () => {
    const doc = createNormalMapDocument();
    addRegion(doc, "a");
    doc.enableNormalMap();
    doc.setNormalMapZone({ regionId: "a", settings: "off" });
    doc.uv.delete("a");
    const seen: string[][] = [];
    doc.on("history-changed", () => seen.push(zoneIds(doc)));

    doc.undo();

    assert.deepEqual(seen, [["a"]]);
  });

  test("undo and redo of a resize restore the exact pixels", () => {
    const events: PixelCommand[] = [];
    const doc = createDocument(events);
    doc.paintPixels([{ x: 3, y: 3 }], kRed);
    doc.resize({ x: 2, y: 2 });
    doc.paintPixels([{ x: 0, y: 0 }], kBlue);
    doc.resize({ x: 4, y: 4 });
    const grown = doc.buffer.pixels();
    doc.undo();
    doc.undo();
    const shrunk = doc.buffer.pixels();
    events.length = 0;

    doc.undo();

    assert.deepEqual(doc.size(), { x: 4, y: 4 });
    assert.deepEqual(pixelAt(doc, 3, 3), [255, 0, 0, 255]);
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "texture-replaced");

    doc.redo();
    doc.redo();
    doc.redo();

    assert.deepEqual(doc.buffer.pixels(), grown);
    assert.notDeepEqual(shrunk, grown);
    const last = events.at(-1);
    assert.equal(last?.action, "texture-replaced");
    if (last?.action === "texture-replaced") {
      assert.deepEqual(decodePixelBytes(last.metadata.pixels), grown);
      assert.equal(typeof last.originTimestamp, "number");
    }
  });

  test("a painted selection edit applies its colors and carries its selection footprints", () => {
    const doc = createDocument();
    const before = { rect: { x: 0, y: 0, width: 1, height: 1 }, mask: [true] };
    const after = { rect: { x: 1, y: 0, width: 1, height: 1 }, mask: [true] };

    doc.paintSelectionEdit({
      positions: [{ x: 1, y: 0 }],
      beforeColors: [{ r: 255, g: 255, b: 255, a: 255 }],
      afterColors: [kRed],
      before,
      after
    });
    assert.deepEqual(pixelAt(doc, 1, 0), [255, 0, 0, 255]);
    const entry = doc.undo();

    assert.deepEqual(entry?.selection, { before, after });
    assert.deepEqual(pixelAt(doc, 1, 0), [255, 255, 255, 255]);
  });
});
