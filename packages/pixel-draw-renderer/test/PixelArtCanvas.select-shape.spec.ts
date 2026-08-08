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
import { makeContainer } from "./helpers/dom.ts";
import {
  canvasPixels,
  readPixel
} from "./fixtures/canvas.ts";
import {
  mouseEvent,
  deleteKey,
  ctrlKey
} from "./helpers/events.ts";

function click(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(
    mouseEvent("mousedown", clientX, clientY)
  );
  canvas.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true })
  );
}

/**
 * Tests for `select` mode's shape (magic-wand) sub-mode, toggled via
 * PixelArtCanvas#tools.select.shape — see PixelArtCanvas.select.spec.ts for the
 * default rectangle-drag behavior these build on.
 */
describe("PixelArtCanvas — select mode (shape sub-mode)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  // Same 200x200/8x8/zoom-4 setup as PixelArtCanvas.select.spec.ts: client
  // 84 + n*4 -> texture n.
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

  test("clicking a connected same-color region selects the whole region, not just the seed pixel", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;

    // texture (2,2), part of the black pair.
    click(canvas, 92, 92);
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 2 }, 8),
      [255, 255, 255, 255]
    );
    manager.destroy();
  });

  test("clicking an isolated pixel with no matching neighbor selects nothing (not 1x1)", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;

    click(canvas, 92, 92);
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(
        manager.texture,
        { x: 2, y: 2 },
        8
      ),
      [0, 0, 0, 255],
      "no selection — nothing erased"
    );
    manager.destroy();
  });

  test("clicking a hollow border selects the border AND its fully enclosed interior", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    // 3x3 black border around (2,2)-(4,4); the interior (3,3) is left at
    // the canvas's own default (opaque white) — a different color than
    // the border, so it reads as an enclosed hole to fill.
    const border = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 }
    ];
    manager.commitPixels(border);
    manager.mode = "select";
    manager.tools.select.shape = true;

    // texture (2,2), a border pixel.
    click(canvas, 92, 92);
    window.dispatchEvent(deleteKey());

    for (const pos of [...border, { x: 3, y: 3 }]) {
      assert.deepStrictEqual(
        readPixel(manager.texture, pos, 8),
        [255, 255, 255, 255],
        `(${pos.x},${pos.y}) should be erased with the dominant (white) surrounding color`
      );
    }
    manager.destroy();
  });

  test("a mousedown+drag over empty space does not fall back to a rectangle selection", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    // Two adjacent but differently-colored pixels: flood fill from (2,2)
    // only matches black, and has no same-colored neighbor.
    manager.brush.primary.set("#000000");
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.brush.primary.set("#FF0000");
    manager.commitPixels([{ x: 3, y: 2 }]);

    manager.mode = "select";
    manager.tools.select.shape = true;

    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 96, 92)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(
        manager.texture,
        { x: 2, y: 2 },
        8
      ),
      [0, 0, 0, 255],
      "no rectangle got created — nothing erased"
    );
    assert.deepStrictEqual(
      readPixel(
        manager.texture,
        { x: 3, y: 2 },
        8
      ),
      [255, 0, 0, 255]
    );
    manager.destroy();
  });

  test("toggling tools.select.shape clears the active selection", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;
    click(canvas, 92, 92);

    manager.tools.select.shape = false;
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(
        manager.texture,
        { x: 2, y: 2 },
        8
      ),
      [0, 0, 0, 255],
      "cleared by the toggle — Delete is a no-op"
    );
    manager.destroy();
  });

  test("moving a concave (L-shaped) selection only touches its masked cells, at both source and destination", () => {
    const manager = makeManager({ select: { eraseColor: "#FF00FF" } });
    const canvas = manager.canvas();

    // L-shape within a 2x2 bounding box: (2,2)-(2,3)-(3,3) are black;
    // (3,2) is deliberately left out (the concave "gap").
    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    // A sentinel at the move's destination gap, to prove the paint step
    // skips masked-false destination cells too.
    manager.brush.primary.set("#0000FF");
    manager.commitPixels([{ x: 5, y: 4 }]);

    manager.mode = "select";
    manager.tools.select.shape = true;
    // texture (2,2).
    click(canvas, 92, 92);

    // Drag by (+2, +2): (2,2)-(2,3)-(3,3) -> (4,4)-(4,5)-(5,5).
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
      readPixel(manager.texture, { x: 3, y: 2 }, 8),
      [255, 255, 255, 255],
      "the L-shape's own gap was never selected — untouched, not the erase color"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 0, 255, 255],
      "source erased"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 3 }, 8),
      [255, 0, 255, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 3 }, 8),
      [255, 0, 255, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "destination painted"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 5 }, 8),
      [0, 0, 0, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 5, y: 5 }, 8),
      [0, 0, 0, 255]
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 5, y: 4 }, 8),
      [0, 0, 255, 255],
      "destination's own gap (the sentinel) is untouched by the masked paint"
    );
    manager.destroy();
  });

  test("moving a shape with transparent erase does not leave its source edge in the drag preview", () => {
    const manager = makeManager({
      select: { eraseColor: "#00000000" }
    });
    const canvas = manager.canvas();

    manager.brush.primary.set("#FF0000");
    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;
    click(canvas, 92, 92);

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));

    const preview = canvasPixels(canvas);
    assert.notDeepStrictEqual(
      readPixel(preview, { x: 2, y: 2 }, canvas.width),
      [255, 0, 0, 255],
      "the vacated source edge must reveal the background before commit"
    );
    assert.deepStrictEqual(
      readPixel(preview, { x: 3, y: 2 }, canvas.width),
      [255, 0, 0, 255],
      "the overlapping destination remains visible"
    );

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    manager.destroy();
  });

  test("undoing a shape move resyncs the selection's true mask, not its bounding rect", () => {
    const manager = makeManager({
      select: { eraseColor: "#FF00FF" },
      history: { enabled: true }
    });
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;
    click(canvas, 92, 92);

    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(ctrlKey("z"));
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "sanity: undo restored the L-shape"
    );

    // If the resynced selection had degraded to a solid 2x2 rect instead of
    // the true L-shaped mask, this second move's erase step (over the
    // resynced oldRect/oldMask) would also vacate (3,2) — which was never
    // part of the shape. The destination is chosen far away so the paint
    // step can't independently touch (3,2) and confound the assertion.
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 108, 108)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 2 }, 8),
      [255, 255, 255, 255],
      "the L-shape's gap must stay untouched after the resync"
    );
    manager.destroy();
  });
});
