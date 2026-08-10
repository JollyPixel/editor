// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CanvasView } from "#src/CanvasView.ts";
import { PixelDocument } from "#src/PixelDocument.ts";
import { makeContainer } from "./helpers/dom.ts";

const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

describe("CanvasView", () => {
  test("destroy() unsubscribes every repaint source", () => {
    const doc = new PixelDocument({
      size: { x: 2, y: 2 }
    });
    const { container } = makeContainer();
    const view = new CanvasView(doc, {
      parent: container,
      brushHighlight: {
        size: 1,
        colorInline: "#fff",
        colorOutline: "#000"
      }
    });
    let drawCount = 0;
    view.renderer.drawFrame = () => {
      drawCount++;
    };

    doc.buffer.drawPixels([{ x: 0, y: 0 }], kRed);
    view.renderer.peerStrokes.set("peer", []);
    view.renderer.floatingSelection.create({
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      pixels: [kRed],
      eraseColor: kRed
    });
    view.renderer.peerFloatingSelections.set("peer", {
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      liveRect: { x: 1, y: 1, width: 1, height: 1 },
      mask: [true],
      blankSource: true
    });
    assert.strictEqual(drawCount, 4);

    view.destroy();

    doc.buffer.drawPixels([{ x: 1, y: 0 }], kRed);
    view.renderer.peerStrokes.set("peer", []);
    view.renderer.floatingSelection.clear();
    view.renderer.peerFloatingSelections.set("peer", {
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      liveRect: { x: 0, y: 1, width: 1, height: 1 },
      mask: [true],
      blankSource: true
    });
    assert.strictEqual(drawCount, 4);
  });
});
