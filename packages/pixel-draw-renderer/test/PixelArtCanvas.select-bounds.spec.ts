// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { mouseEvent } from "./helpers/events.ts";
import { stubRect } from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";

describe("PixelArtCanvas — rectangle selection bounds", () => {
  test("can extend outside the texture while drawing, then snaps to its bounds on release", () => {
    const { manager, canvas, overlay } = createPixelArtCanvas({
      zoom: { default: 4 }
    });

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 76, 76));
    canvas.dispatchEvent(mouseEvent("mousemove", 124, 124));

    const outlines = [
      ...overlay.querySelectorAll("[data-overlay=selection]")
    ];
    assert.strictEqual(outlines.length, 2);
    for (const outline of outlines) {
      assert.strictEqual(outline.getAttribute("d"), "M 76 76 L 128 76 L 128 128 L 76 128 Z");
    }

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    for (const outline of outlines) {
      assert.strictEqual(outline.getAttribute("d"), "M 84 84 L 116 84 L 116 116 L 84 116 Z");
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

  test("redraws the rectangle being drawn when the viewport moves", () => {
    const { manager, canvas, overlay, container } = createPixelArtCanvas({
      zoom: { default: 4 }
    });

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 76, 76));
    canvas.dispatchEvent(mouseEvent("mousemove", 124, 124));
    stubRect(container, { width: 300, height: 300 });
    manager.onResize();

    for (const outline of overlay.querySelectorAll("[data-overlay=selection]")) {
      assert.strictEqual(outline.getAttribute("d"), "M 126 126 L 178 126 L 178 178 L 126 178 Z");
    }
    manager.destroy();
  });
});
