// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createPixelArtCanvas } from "./helpers/canvas.ts";
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

describe("PixelArtCanvas built on an existing PixelDocument", () => {
  test("shares the document instead of creating one", () => {
    const doc = createDocument();
    const { manager } = createPixelArtCanvas({ document: doc });

    assert.equal(manager.document, doc);
    assert.equal(manager.uv, doc.uv);
    assert.deepEqual(manager.textureSize, { x: 4, y: 4 });
  });

  test("follows a remote resize of the shared document", () => {
    const doc = createDocument();
    const { manager } = createPixelArtCanvas({ document: doc });

    doc.applyRemoteCommand({
      action: "resized",
      metadata: { size: { x: 6, y: 6 } }
    });

    assert.deepEqual(manager.textureSize, { x: 6, y: 6 });
  });

  test("forwards document draw-end and history changes to its callbacks", () => {
    const doc = createDocument();
    let drawEnds = 0;
    let historyChanges = 0;
    const { manager } = createPixelArtCanvas({
      document: doc,
      onDrawEnd: () => drawEnds++,
      onHistoryChange: () => historyChanges++
    });

    doc.commitPixels([{ x: 0, y: 0 }], kRed);
    manager.destroy();
    doc.commitPixels([{ x: 1, y: 0 }], kRed);

    assert.equal(drawEnds, 1);
    assert.equal(historyChanges, 1);
  });

  test("undo on one canvas reverts the edit for every canvas on the document", () => {
    const doc = createDocument();
    const first = createPixelArtCanvas({ document: doc });
    const second = createPixelArtCanvas({ document: doc });
    const before = pixelAt(doc, 3, 3);

    first.manager.commitPixels([{ x: 3, y: 3 }]);
    assert.equal(second.manager.canUndo(), true);

    second.manager.undo();

    assert.deepEqual(pixelAt(doc, 3, 3), before);
    assert.equal(first.manager.canUndo(), false);
  });
});
