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
import { readPixel } from "./fixtures/canvas.ts";
import { makeContainer } from "./helpers/dom.ts";
import {
  mouseEvent,
  ctrlKey
} from "./helpers/events.ts";

describe("PixelArtCanvas — select mode clipboard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  // 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
  // client 84 + n*4 -> texture n, exactly (chosen to land on pixel starts,
  // no floor-rounding ambiguity).

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

  test("Ctrl+C then Ctrl+V duplicates in place; moving the duplicate away leaves the original untouched", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 96, 92)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(ctrlKey("c"));
    window.dispatchEvent(ctrlKey("v"));

    // The pasted copy landed exactly on the original position (invisible
    // until moved) and is now the active selection — dragging it away
    // must relocate only the *duplicate*, leaving the original in place.
    // (Regression: a naive move erases its source unconditionally, which
    // would wipe out the original here since source === original spot.)
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "original survives the duplicate's first move"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "duplicate landed at destination"
    );
    manager.destroy();
  });

  test("moving an already-relocated duplicate a second time erases its (now real) previous spot", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 96, 92)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(ctrlKey("c"));
    window.dispatchEvent(ctrlKey("v"));

    // First move: relocates the duplicate to (4,4), original at (2,2) survives.
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    // Second move: the duplicate now legitimately owns (4,4) — moving it
    // again to (6,6) must erase (4,4) for real this time.
    canvas.dispatchEvent(
      mouseEvent("mousedown", 100, 100)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 108, 108)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "original still untouched"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [255, 255, 255, 255],
      "second move erases the duplicate's now-real previous spot, with the dominant (white) surrounding color"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 6, y: 6 }, 8),
      [0, 0, 0, 255],
      "duplicate landed at the new destination"
    );
    manager.destroy();
  });

  test("Ctrl+V without a prior Ctrl+C is a no-op", () => {
    const manager = makeManager();
    const before = manager.texture.slice();

    window.dispatchEvent(ctrlKey("v"));

    assert.deepStrictEqual(
      manager.texture,
      before
    );
    manager.destroy();
  });
});
