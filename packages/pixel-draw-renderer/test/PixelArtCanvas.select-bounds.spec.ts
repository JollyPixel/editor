// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { mouseEvent } from "./helpers/events.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";

describe("PixelArtCanvas — rectangle selection bounds", () => {
  test("can extend outside the texture while drawing, then snaps to its bounds on release", () => {
    const { manager, canvas, overlay } = createPixelArtCanvas({
      zoom: { default: 4 }
    });

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 76, 76));
    canvas.dispatchEvent(mouseEvent("mousemove", 124, 124));

    const selectionRects = [
      ...overlay.querySelectorAll("rect[stroke-dasharray]")
    ];
    assert.strictEqual(selectionRects.length, 2);
    for (const rect of selectionRects) {
      assert.strictEqual(rect.getAttribute("x"), "76");
      assert.strictEqual(rect.getAttribute("y"), "76");
      assert.strictEqual(rect.getAttribute("width"), "52");
      assert.strictEqual(rect.getAttribute("height"), "52");
    }

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    for (const rect of selectionRects) {
      assert.strictEqual(rect.getAttribute("x"), "84");
      assert.strictEqual(rect.getAttribute("y"), "84");
      assert.strictEqual(rect.getAttribute("width"), "32");
      assert.strictEqual(rect.getAttribute("height"), "32");
    }
    assert.ok(manager.tools.select.hasSelection);
    manager.destroy();
  });

  test("discards a completed rectangle entirely outside the texture", () => {
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 }
    });

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 40, 40));
    canvas.dispatchEvent(mouseEvent("mousemove", 60, 60));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.ok(!manager.tools.select.hasSelection);
    manager.destroy();
  });
});
