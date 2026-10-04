// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  canvasPixels,
  readPixel
} from "./fixtures/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import { createSelectCanvas } from "./helpers/select-canvas/manager.ts";

describe("PixelArtCanvas — select mode", () => {
  test("Delete falls back to transparent when the vacated rect has no in-bounds neighbors", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 0, y: 0 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 112, 112));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.delete();

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 0, y: 0 }, 8),
      [0, 0, 0, 0]
    );
    manager.destroy();
  });

  test("select.eraseColor overrides the default erase color", () => {
    const manager = createSelectCanvas({
      select: { eraseColor: "#FF00FF" }
    });
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.delete();

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 0, 255, 255],
      "erase color overridden by select.eraseColor"
    );
    manager.destroy();
  });

  test("dragging a real (non-pasted) selection previews the source as vacated mid-drag", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));

    const midDragPixels = canvasPixels(canvas);
    assert.deepStrictEqual(
      readPixel(midDragPixels, { x: 2, y: 2 }, canvas.width),
      [255, 255, 255, 255],
      "source previewed as vacated (dominant surrounding color) while a real move is in progress"
    );

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    manager.destroy();
  });

  test("dragging a just-pasted duplicate does NOT preview the original as vacated (regression)", async() => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    await manager.copySelection();
    await manager.pasteClipboard();

    const afterPaste = readPixel(
      canvasPixels(canvas),
      { x: 2, y: 2 },
      canvas.width
    );

    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );

    const midDrag = readPixel(
      canvasPixels(canvas),
      { x: 2, y: 2 },
      canvas.width
    );
    assert.deepStrictEqual(
      midDrag,
      afterPaste,
      "unchanged from before the drag — nothing is actually being vacated"
    );

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    manager.destroy();
  });

  describe("cursor", () => {
    test("drawing a brand-new rectangle keeps the plain cursor (not a grab motion)", () => {
      const manager = createSelectCanvas();
      const canvas = manager.canvas();

      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      assert.strictEqual(canvas.style.cursor, "");

      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      assert.strictEqual(canvas.style.cursor, "");

      manager.destroy();
    });

    test("dragging an existing selection sets the cursor to grabbing, and back to grab on release", () => {
      const manager = createSelectCanvas();
      const canvas = manager.canvas();

      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.strictEqual(canvas.style.cursor, "grab");

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      assert.strictEqual(canvas.style.cursor, "grabbing");

      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.strictEqual(canvas.style.cursor, "grab");

      manager.destroy();
    });
  });

  test("a plain click (no drag) does not create a selection", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.delete();

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "no selection — nothing erased"
    );
    manager.destroy();
  });

  test("clicking outside the current selection discards it and starts a new one", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    canvas.dispatchEvent(mouseEvent("mousedown", 108, 108));
    canvas.dispatchEvent(mouseEvent("mousemove", 112, 108));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.delete();

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "old selection untouched"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 6, y: 6 }, 8),
      [255, 255, 255, 255],
      "new selection erased with the dominant (white) surrounding color"
    );
    manager.destroy();
  });

  test("dragging a selection out of texture bounds still erases its source", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 1, y: 1 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 88));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
    canvas.dispatchEvent(mouseEvent("mousemove", 0, 0));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 1, y: 1 }, 8),
      [255, 255, 255, 255],
      "source erased with the dominant (white) surrounding color"
    );
    manager.destroy();
  });
});
