// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import { registerPixelHistory } from "#src/history/pixelHistoryRegistration.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import { readPixel } from "./fixtures/canvas.ts";
import type { SelectionRect } from "#src/types.ts";

function outlineOf(
  rect: SelectionRect
): string {
  const left = 84 + (rect.x * 4);
  const top = 84 + (rect.y * 4);
  const right = left + (rect.width * 4);
  const bottom = top + (rect.height * 4);

  return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
}

function outlineIn(
  overlay: SVGSVGElement
): string | null | undefined {
  return overlay.querySelector("[data-overlay=selection]")?.getAttribute("d");
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
    const history = new CommandHistory({ scopes: ["build", "animate"] });
    const { manager, canvas, overlay } = createPixelArtCanvas({
      document: ownedDocument(history),
      zoom: { default: 4 },
      history: { history, scope: "build" }
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
    assert.equal(outlineIn(overlay), outlineOf({ x: 4, y: 4, width: 2, height: 2 }));

    assert.equal(history.undo("build"), true);
    assert.deepEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), [0, 0, 0, 255]);
    assert.equal(outlineIn(overlay), outlineOf({ x: 2, y: 2, width: 2, height: 2 }));

    assert.equal(history.redo("build"), true);
    assert.deepEqual(readPixel(manager.texture, { x: 4, y: 4 }, 8), [0, 0, 0, 255]);
    assert.equal(outlineIn(overlay), outlineOf({ x: 4, y: 4, width: 2, height: 2 }));
    manager.destroy();
  });

  test("leaves the document to its owner: pixel steps still undo once the canvas closes", () => {
    const history = new CommandHistory({ scopes: ["build"] });
    const document = ownedDocument(history);
    const { manager } = createPixelArtCanvas({
      document,
      history: { history, scope: "build" }
    });
    const before = document.buffer.samplePixels([{ x: 0, y: 0 }]);
    manager.commitPixels([{ x: 0, y: 0 }]);

    manager.destroy();

    assert.equal(history.undo("build"), true);
    assert.deepEqual(document.buffer.samplePixels([{ x: 0, y: 0 }]), before);
  });

  test("a selection step refuses as closed once its canvas closes", () => {
    const history = new CommandHistory({ scopes: ["build"] });
    const { manager, canvas } = createPixelArtCanvas({
      document: ownedDocument(history),
      zoom: { default: 4 },
      history: { history, scope: "build" }
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
