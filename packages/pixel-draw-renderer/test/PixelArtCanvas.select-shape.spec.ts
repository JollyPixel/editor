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

describe("PixelArtCanvas — select mode (shape sub-mode)", () => {
  test("clicking a connected same-color region selects the whole region, not just the seed pixel", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;

    click(canvas, 92, 92);
    manager.shortcuts.delete();

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

  test("dragging from an isolated seed selects nothing: no 1x1 shape and no rectangle fallback", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

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

    assert.strictEqual(manager.tools.select.hasSelection, false);

    manager.shortcuts.delete();

    assert.deepStrictEqual(
      readPixel(
        manager.texture,
        { x: 2, y: 2 },
        8
      ),
      [0, 0, 0, 255],
      "no selection — nothing erased"
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
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ]);
    manager.mode = "select";
    manager.tools.select.shape = true;
    click(canvas, 92, 92);

    manager.tools.select.shape = false;
    manager.shortcuts.delete();

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

  test(
    "moving a concave (L-shaped) selection only touches its masked cells, at both source and destination",
    () => {
      const manager = createSelectCanvas({ select: { eraseColor: "#FF00FF" } });
      const canvas = manager.canvas();

      manager.commitPixels([
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 }
      ]);
      const destinationGapSentinel = { x: 5, y: 4 };
      manager.brush.primary.set("#0000FF");
      manager.commitPixels([destinationGapSentinel]);

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
        readPixel(manager.texture, destinationGapSentinel, 8),
        [0, 0, 255, 255],
        "destination's own gap (the sentinel) is untouched by the masked paint"
      );
      manager.destroy();
    }
  );

  test("undoing a shape move resyncs the selection's true mask, not its bounding rect", () => {
    const manager = createSelectCanvas({
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

    manager.shortcuts.undo();
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "sanity: undo restored the L-shape"
    );

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
      "the L-shape's gap must stay untouched by a move erasing the resynced mask, not its 2x2 rect"
    );
    manager.destroy();
  });
});
