// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import { readPixel } from "./fixtures/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import {
  paintHorizontalPair,
  selectHorizontalPair
} from "./helpers/select.ts";
import { createSelectCanvas } from "./helpers/select-canvas/manager.ts";

describe("PixelArtCanvas — select mode rotate/flip", () => {
  test("rotating counter-clockwise turns a selection 90deg counter-clockwise", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    paintHorizontalPair(manager);
    manager.mode = "select";
    selectHorizontalPair(canvas);

    manager.shortcuts.rotate("ccw");

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 2 }, 8),
      [255, 0, 0, 255],
      "rotated: the right pixel is now on top"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 3 }, 8),
      [0, 0, 0, 255],
      "rotated: the left pixel is now on the bottom"
    );
    manager.destroy();
  });

  test("flipVertical() mirrors the active selection's content top-bottom in place", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.brush.primary.set("#000000");
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.brush.primary.set("#FF0000");
    manager.commitPixels([{ x: 2, y: 3 }]);

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.flipVertical();

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 0, 0, 255],
      "mirrored: red is now on top"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 3 }, 8),
      [0, 0, 0, 255],
      "mirrored: black is now on the bottom"
    );
    manager.destroy();
  });

  test("tools.select rotate/flip mirror the shortcuts, and no-op safely without a selection", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    assert.ok(!manager.tools.select.rotate(), "no selection yet");
    assert.ok(!manager.tools.select.flipHorizontal());
    assert.ok(!manager.tools.select.flipVertical());

    paintHorizontalPair(manager);
    manager.mode = "select";
    selectHorizontalPair(canvas);

    assert.ok(manager.tools.select.flipHorizontal());
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 0, 0, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 2 }, 8),
      [0, 0, 0, 255]
    );

    assert.ok(manager.tools.select.rotate());
    manager.destroy();
  });

  test("rotate, flip and delete each fire onDrawEnd and a 'select-edit' onBufferUpdated", () => {
    let drawEndCount = 0;
    const events: PixelCommand[] = [];
    const manager = createSelectCanvas({
      onDrawEnd: () => {
        drawEndCount++;
      },
      onCommand: (event) => events.push(event)
    });
    const canvas = manager.canvas();

    paintHorizontalPair(manager);
    drawEndCount = 0;
    events.length = 0;

    manager.mode = "select";
    selectHorizontalPair(canvas);

    manager.shortcuts.rotate("cw");
    manager.shortcuts.flipHorizontal();
    manager.shortcuts.flipVertical();
    manager.shortcuts.delete();

    assert.strictEqual(drawEndCount, 4);
    assert.strictEqual(events.length, 4);
    for (const event of events) {
      assert.strictEqual(event.action, "select-edit");
    }
    manager.destroy();
  });

  describe("undo/redo", () => {
    test("undo/redo covers a clockwise Rotate around the selection's center", () => {
      const manager = createSelectCanvas({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(canvas);

      manager.shortcuts.rotate("cw");
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255],
        "old footprint vacated with the dominant (white) surrounding color"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255],
        "rotated: the left pixel is now on top"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 0, 0, 255],
        "rotated: the right pixel is now on the bottom"
      );

      manager.shortcuts.undo();
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the pre-rotate layout"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 255, 255, 255]
      );

      manager.shortcuts.redo();
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 0, 0, 255]
      );
      manager.destroy();
    });

    test("undoing a Rotate resyncs the selection box, so a follow-up rotate doesn't corrupt pixels", () => {
      const manager = createSelectCanvas({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(canvas);

      manager.shortcuts.rotate("cw");
      manager.shortcuts.undo();
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "sanity: undo restored the pre-rotate layout"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [255, 0, 0, 255]
      );

      manager.shortcuts.rotate("cw");
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255],
        "the real pre-rotate footprint got erased with the dominant (white) surrounding color"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 3 }, 8),
        [255, 255, 255, 255],
        "a pixel outside the stale post-rotate footprint must stay untouched"
      );
      manager.destroy();
    });

    test("undo/redo covers a horizontal Flip in place", () => {
      const manager = createSelectCanvas({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(canvas);

      manager.shortcuts.flipHorizontal();
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 0, 0, 255],
        "mirrored: red is now on the left"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255],
        "mirrored: black is now on the right"
      );

      manager.shortcuts.undo();
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the pre-flip layout"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [255, 0, 0, 255]
      );

      manager.shortcuts.redo();
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255]
      );
      manager.destroy();
    });
  });
});
