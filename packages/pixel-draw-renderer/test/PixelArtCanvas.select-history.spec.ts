// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { readPixel } from "./fixtures/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import { createSelectCanvas } from "./helpers/select-canvas/manager.ts";

describe("PixelArtCanvas — select mode undo/redo", () => {
  test("undo/redo covers a Move that erases the source and paints the destination", () => {
    const manager = createSelectCanvas({
      history: { enabled: true }
    });
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "source vacated with the dominant (white) surrounding color"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "destination got the moved pixel"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 5, y: 5 }, 8),
      [0, 0, 0, 255],
      "destination got the whole moved rectangle"
    );

    manager.shortcuts.undo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "undo restores the source"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [255, 255, 255, 255],
      "undo removes the destination"
    );

    manager.shortcuts.redo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255]
    );
    manager.destroy();
  });

  test("undoing a select-edit outside select mode restores pixels, not the selection", () => {
    const manager = createSelectCanvas({
      history: { enabled: true }
    });
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
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.mode = "paint";

    manager.shortcuts.undo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "undo restores the source pixels regardless of mode"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [255, 255, 255, 255],
      "undo removes the destination pixels regardless of mode"
    );

    manager.mode = "select";
    assert.strictEqual(
      manager.tools.select.hasSelection,
      false,
      "an undo outside select mode must not resurrect the old selection when select mode is re-entered"
    );

    manager.destroy();
  });

  test("undo/redo covers a Delete that fills the rectangle with the dominant surrounding color", () => {
    const manager = createSelectCanvas({
      history: { enabled: true }
    });
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.delete();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 3 }, 8),
      [255, 255, 255, 255]
    );

    manager.shortcuts.undo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "undo restores the deleted pixels"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 3 }, 8),
      [0, 0, 0, 255]
    );

    manager.shortcuts.redo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "redo re-applies the delete"
    );
    manager.destroy();
  });

  test("undo/redo covers a Paste", async() => {
    const manager = createSelectCanvas({
      history: { enabled: true }
    });
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    await manager.copySelection();

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "the original moved away, so the paste target is empty"
    );

    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    await manager.pasteClipboard();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "paste stays out of the texture until placement"
    );
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "the 2x1 paste is centred on the cursor at (3,2), so its left pixel lands on (2,2)"
    );

    manager.shortcuts.undo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "undo removes the pasted content"
    );

    manager.shortcuts.redo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "redo re-applies the paste"
    );
    manager.destroy();
  });

  test("undoing a texture clear discards the selection", () => {
    const manager = createSelectCanvas({
      history: { enabled: true }
    });
    const canvas = manager.canvas();
    manager.clearTexture({ includeUV: true });
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assert.ok(manager.tools.select.hasSelection);

    manager.shortcuts.undo();

    assert.ok(!manager.tools.select.hasSelection);
    manager.destroy();
  });

  test("a move partly off the texture records only pixels inside it", () => {
    const manager = createSelectCanvas({
      history: { enabled: true }
    });
    const canvas = manager.canvas();
    const positions: { x: number; y: number; }[] = [];
    manager.document.on("command", (command) => {
      if (command.action === "select-edit") {
        positions.push(...command.metadata.positions);
      }
    });
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 112, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(
      positions.filter(({ x }) => x >= 8),
      []
    );
    assert.ok(positions.some(({ x }) => x === 7));
    manager.shortcuts.undo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 7, y: 2 }, 8),
      [255, 255, 255, 255]
    );
    manager.destroy();
  });
});
