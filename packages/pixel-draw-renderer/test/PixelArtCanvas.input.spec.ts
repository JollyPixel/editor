// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  moveTo,
  wheel
} from "./helpers/events.ts";

describe("PixelArtCanvas — Ctrl+wheel brush size", () => {
  test("adjusts the brush one pixel per scroll direction in paint mode", () => {
    const { manager, canvas } = createPixelArtCanvas({
      brush: { size: 4, maxSize: 8 }
    });

    canvas.dispatchEvent(wheel({ deltaY: -100, ctrlKey: true }));
    assert.strictEqual(manager.brush.size, 5);

    canvas.dispatchEvent(wheel({ deltaY: 100, ctrlKey: true }));
    assert.strictEqual(manager.brush.size, 4);
    manager.destroy();
  });

  test("keeps Ctrl+wheel zoom in non-paint modes", () => {
    const { manager, canvas } = createPixelArtCanvas({
      brush: { size: 4, maxSize: 8 },
      zoom: { default: 4 }
    });
    manager.mode = "fill";
    const zoomBefore = manager.zoom.value;

    canvas.dispatchEvent(wheel({ deltaY: 100, ctrlKey: true }));

    assert.strictEqual(manager.brush.size, 4);
    assert.ok(manager.zoom.value < zoomBefore);
    manager.destroy();
  });

  test("refreshes the visible brush overlay after resizing", () => {
    const { manager, canvas, children } = createPixelArtCanvas({
      brush: { size: 4, maxSize: 8 }
    });
    moveTo(canvas, 100, 100);

    canvas.dispatchEvent(wheel({ deltaY: -100, ctrlKey: true }));

    const overlay = children[1] as unknown as SVGElement;
    const highlight = overlay.querySelector("g");
    assert.ok(
      highlight?.getAttribute("transform")?.includes(`scale(${manager.zoom.value * 5})`)
    );
    manager.destroy();
  });
});
