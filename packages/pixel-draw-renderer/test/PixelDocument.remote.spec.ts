// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import {
  createDocument,
  pixelAt
} from "./helpers/document/document.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kDrawingCommands: PixelCommand[] = [
  {
    action: "stroke",
    metadata: { color: kRed, positions: [{ x: 0, y: 0 }] }
  },
  {
    action: "select-edit",
    metadata: { positions: [{ x: 0, y: 0 }], colors: [kRed] }
  },
  {
    action: "global-fill",
    metadata: {
      fromColor: { r: 255, g: 255, b: 255, a: 255 },
      toColor: kRed
    }
  }
];

describe("PixelDocument", () => {
  describe("remote commands", () => {
    test("applies a stroke without echoing a hook or recording history, keeping local history", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;
      let changed = 0;
      doc.on("changed", () => changed++);

      doc.applyRemoteCommand({
        action: "stroke",
        metadata: { color: kRed, positions: [{ x: 2, y: 3 }] }
      });

      assert.deepEqual(pixelAt(doc, 2, 3), [255, 0, 0, 255]);
      assert.equal(events.length, 0);
      assert.equal(changed, 1);
      assert.equal(doc.history.canUndo, true);

      doc.undo();
      assert.equal(doc.history.canUndo, false);
      assert.deepEqual(pixelAt(doc, 2, 3), [255, 0, 0, 255]);
    });

    for (const command of kDrawingCommands) {
      test(`a remote ${command.action} fires draw-end`, () => {
        const doc = createDocument();
        let drawEnds = 0;
        doc.on("draw-end", () => drawEnds++);

        doc.applyRemoteCommand(command);

        assert.equal(drawEnds, 1);
      });
    }

    test("a remote resize emits resized then reset, clears history and does not echo", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;
      const order: string[] = [];
      doc.on("resized", () => order.push("resized"));
      doc.on("reset", () => order.push("reset"));

      doc.applyRemoteCommand({
        action: "resized",
        metadata: { size: { x: 8, y: 2 } }
      });

      assert.deepEqual(doc.size(), { x: 8, y: 2 });
      assert.deepEqual(order, ["resized", "reset"]);
      assert.equal(doc.history.canUndo, false);
      assert.equal(events.length, 0);
    });

    test("remote texture-replaced decodes pixels, clears history, emits replaced then reset, no echo", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;
      const order: string[] = [];
      doc.on("replaced", (event) => order.push(`replaced:${event.size.x}`));
      doc.on("reset", () => order.push("reset"));
      const pixels = new Uint8Array([
        10, 20, 30, 255,
        40, 50, 60, 255,
        70, 80, 90, 255,
        100, 110, 120, 255
      ]);

      doc.applyRemoteCommand({
        action: "texture-replaced",
        metadata: {
          size: { x: 2, y: 2 },
          pixels: fromUint8Array(pixels)
        }
      });

      assert.deepEqual(pixelAt(doc, 0, 0), [10, 20, 30, 255]);
      assert.deepEqual(pixelAt(doc, 1, 1), [100, 110, 120, 255]);
      assert.deepEqual(order, ["replaced:2", "reset"]);
      assert.equal(doc.history.canUndo, false);
      assert.equal(events.length, 0);
    });
  });
});
