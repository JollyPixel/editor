// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { readPixel } from "./fixtures/canvas.ts";
import { makeContainer } from "./helpers/dom.ts";
import { mouseEvent } from "./helpers/events.ts";
import {
  paintHorizontalPair,
  selectHorizontalPair
} from "./helpers/select.ts";

describe("PixelArtCanvas — select mode rotate/flip", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  /*
   * 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
   * client 84 + n*4 -> texture n, exactly (chosen to land on pixel starts,
   * no floor-rounding ambiguity).
   */

  function makeManager(
    options: PixelArtCanvasOptions = {}
  ): PixelArtCanvas {
    return new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      zoom: { default: 4 },
      ...options
    });
  }

  test("rotating clockwise turns a non-square selection 90deg clockwise around its center", () => {
    const manager = makeManager();
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
    manager.destroy();
  });

  test("rotating counter-clockwise turns a selection 90deg counter-clockwise", () => {
    const manager = makeManager();
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

  test("flipHorizontal() mirrors the active selection's content left-right in place", () => {
    const manager = makeManager();
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
    manager.destroy();
  });

  test("flipVertical() mirrors the active selection's content top-bottom in place", () => {
    const manager = makeManager();
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

  test("rotate and flip shortcuts are no-ops without an active selection", () => {
    const manager = makeManager();
    const before = manager.texture.slice();

    assert.doesNotThrow(() => {
      manager.shortcuts.rotate("cw");
      manager.shortcuts.flipHorizontal();
      manager.shortcuts.flipVertical();
    });

    assert.deepStrictEqual(manager.texture, before);
    manager.destroy();
  });

  test("tools.select rotate/flip mirror the shortcuts, and no-op safely without a selection", () => {
    const manager = makeManager();
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

  test(
    "rotate/flip fire onDrawEnd and a 'select-edit' onBufferUpdated each, same as move/delete/paste",
    () => {
      let drawEndCount = 0;
      const events: PixelBufferHookEvent[] = [];
      const manager = makeManager({
        onDrawEnd: () => {
          drawEndCount++;
        },
        onBufferUpdated: (event) => events.push(event)
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

      assert.strictEqual(drawEndCount, 3);
      assert.strictEqual(events.length, 3);
      for (const event of events) {
        assert.strictEqual(event.action, "select-edit");
      }
      manager.destroy();
    }
  );
});
