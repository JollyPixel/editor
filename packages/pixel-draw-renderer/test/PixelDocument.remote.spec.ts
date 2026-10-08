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
const kBlue = {
  r: 0,
  g: 0,
  b: 255,
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
    test("applies a stroke elsewhere without echo or history, keeping local history", () => {
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
      assert.equal(doc.canUndo, true);

      doc.undo();
      assert.equal(doc.canUndo, false);
      assert.deepEqual(pixelAt(doc, 2, 3), [255, 0, 0, 255]);
    });

    test("a peer stroke is reported as a remote change naming the peer", () => {
      const doc = createDocument();
      const changes: (string | null)[] = [];
      doc.on("change", (change) => changes.push(`${change.origin}:${change.clientId}`));

      doc.applyRemoteCommand({
        action: "stroke",
        metadata: { color: kBlue, positions: [{ x: 1, y: 0 }] }
      }, "peer");

      assert.deepEqual(changes, ["remote:peer"]);
      assert.deepEqual(pixelAt(doc, 1, 0), [0, 0, 255, 255]);
    });

    test("a remote global fill is reported as a stroke over the pixels it filled", () => {
      const doc = createDocument();
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      doc.paintPixels([{ x: 3, y: 3 }], kBlue);
      const written: unknown[] = [];
      doc.on("change", (change) => written.push(change.command));

      doc.applyRemoteCommand({
        action: "global-fill",
        metadata: { fromColor: kBlue, toColor: kRed }
      }, "peer");

      assert.deepEqual(written, [{
        action: "stroke",
        metadata: { color: kRed, positions: [{ x: 3, y: 3 }] }
      }]);
    });

    test("replaying a pending command updates the guards instead of refusing", () => {
      const doc = createDocument();
      const changes: string[] = [];
      doc.on("change", (change) => changes.push(change.origin));
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      doc.paintPixels([{ x: 1, y: 1 }], kBlue);

      doc.replayPendingCommand({
        action: "stroke",
        metadata: { color: kBlue, positions: [{ x: 0, y: 0 }] }
      });

      assert.deepEqual(changes, ["local", "local", "replay"]);
      assert.equal(doc.state.undoCount, 2);
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

    test("a remote resize does not echo", () => {
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
      assert.deepEqual(order, ["resized"]);
      assert.equal(events.length, 0);
    });

    test("remote texture-replaced decodes pixels without an echo", () => {
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
      assert.deepEqual(order, ["replaced:2"]);
      assert.equal(events.length, 0);
    });
  });
});
