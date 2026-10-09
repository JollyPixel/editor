// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  PixelDocument,
  type PixelArtCanvas,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { registerPixelHistory } from "#src/history/pixelHistoryRegistration.ts";
import {
  SharedPixelHistory,
  StandalonePixelHistory
} from "#src/history/PixelCanvasHistory.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { mouseEvent } from "../helpers/events.ts";
import { readPixel } from "../fixtures/canvas.ts";

function selectedRect(
  canvas: PixelArtCanvas
): SelectionRect | null {
  const presence = canvas.selectionPresence?.toJSON();

  return presence?.phase === "selected" ? presence.rect : null;
}

function drag(
  canvas: HTMLCanvasElement,
  from: number,
  to: number
): void {
  canvas.dispatchEvent(mouseEvent("mousedown", from, from));
  canvas.dispatchEvent(mouseEvent("mousemove", to, to));
  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function ownedDocument(
  history: CommandHistory<string>
): PixelDocument {
  const document = new PixelDocument({
    size: {
      x: 8,
      y: 8
    }
  });
  registerPixelHistory(history, document, { scope: "build" });

  return document;
}

describe("PixelArtCanvas on a shared history", () => {
  test("files edits in the owner's scope; an undo there restores the selection after the pixels", () => {
    const history = new CommandHistory<"build" | "animate">();
    const { manager, canvas } = createPixelArtCanvas({
      document: ownedDocument(history),
      zoom: { default: 4 },
      history: new SharedPixelHistory(history, "build")
    });
    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    manager.mode = "select";
    drag(canvas, 92, 96);
    drag(canvas, 95, 103);

    assert.equal(history.state("build").undoCount, 2);
    assert.equal(history.state("animate").undoCount, 0);
    assert.deepEqual(selectedRect(manager), { x: 4, y: 4, width: 2, height: 2 });

    assert.equal(history.undo("build"), true);
    assert.deepEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), [0, 0, 0, 255]);
    assert.deepEqual(selectedRect(manager), { x: 2, y: 2, width: 2, height: 2 });

    assert.equal(history.redo("build"), true);
    assert.deepEqual(readPixel(manager.texture, { x: 4, y: 4 }, 8), [0, 0, 0, 255]);
    assert.deepEqual(selectedRect(manager), { x: 4, y: 4, width: 2, height: 2 });
    manager.destroy();
  });

  test("leaves the document to its owner: pixel steps still undo once the canvas closes", () => {
    const history = new CommandHistory<"build">();
    const document = ownedDocument(history);
    const { manager } = createPixelArtCanvas({
      document,
      history: new SharedPixelHistory(history, "build")
    });
    const before = document.buffer.samplePixels([{ x: 0, y: 0 }]);
    manager.commitPixels([{ x: 0, y: 0 }]);

    manager.destroy();

    assert.equal(history.undo("build"), true);
    assert.deepEqual(document.buffer.samplePixels([{ x: 0, y: 0 }]), before);
  });

  test("a selection step refuses as closed once its canvas closes", () => {
    const history = new CommandHistory<"build">();
    const { manager, canvas } = createPixelArtCanvas({
      document: ownedDocument(history),
      zoom: { default: 4 },
      history: new SharedPixelHistory(history, "build")
    });
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    drag(canvas, 92, 96);
    drag(canvas, 95, 103);

    manager.destroy();

    assert.equal(history.undo("build"), true);
    assert.deepEqual(history.state("build").refused.map(({ refused }) => refused.reason), ["closed"]);
  });
});

describe("StandalonePixelHistory", () => {
  test("one history per document, kept for the canvases opened on it later", () => {
    const history = new StandalonePixelHistory();
    const document = new PixelDocument({ size: { x: 4, y: 4 } });
    const other = new PixelDocument({ size: { x: 4, y: 4 } });
    const first = createPixelArtCanvas({ document, history });
    const elsewhere = createPixelArtCanvas({ document: other, history });
    const before = readPixel(document.buffer.pixels(), { x: 3, y: 3 }, 4);
    first.manager.commitPixels([{ x: 3, y: 3 }]);
    first.manager.destroy();

    const second = createPixelArtCanvas({ document, history });

    assert.equal(elsewhere.manager.canUndo(), false);
    assert.equal(second.manager.undo(), true);
    assert.deepEqual(readPixel(document.buffer.pixels(), { x: 3, y: 3 }, 4), before);
  });

  test("canvases on one document share its history through separate instances", () => {
    const document = new PixelDocument({ size: { x: 4, y: 4 } });
    const first = createPixelArtCanvas({
      document,
      history: new StandalonePixelHistory()
    });
    const second = createPixelArtCanvas({
      document,
      history: new StandalonePixelHistory()
    });
    const before = readPixel(document.buffer.pixels(), { x: 3, y: 3 }, 4);
    first.manager.commitPixels([{ x: 3, y: 3 }]);

    assert.equal(second.manager.undo(), true);

    assert.deepEqual(readPixel(document.buffer.pixels(), { x: 3, y: 3 }, 4), before);
    assert.equal(first.manager.canUndo(), false);
    assert.equal(first.manager.canRedo(), true);
  });
});
