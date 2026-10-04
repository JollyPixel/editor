// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import {
  createPixelArtCanvas,
  type CreatedPixelArtCanvas
} from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";

describe("PixelArtCanvas — selection size label", () => {
  function makeManager(
    options: PixelArtCanvasOptions = {}
  ): CreatedPixelArtCanvas {
    return createPixelArtCanvas({
      zoom: { default: 4 },
      ...options
    });
  }

  function sizeLabel(
    overlay: SVGSVGElement
  ): Element | null {
    return overlay.querySelector(
      "[data-overlay='selection-size']"
    );
  }

  function dragSelection(
    manager: PixelArtCanvas
  ): void {
    const canvas = manager.canvas();

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
  }

  test("a dragged selection shows its size, and deselecting hides it", () => {
    const { manager, overlay } = makeManager();

    dragSelection(manager);

    assert.strictEqual(sizeLabel(overlay)?.textContent, "3×3");
    assert.strictEqual(
      sizeLabel(overlay)?.getAttribute("visibility"),
      "visible"
    );

    manager.mode = "paint";

    assert.strictEqual(
      sizeLabel(overlay)?.getAttribute("visibility"),
      "hidden"
    );
    manager.destroy();
  });

  test("select.sizeLabel: false renders no label", () => {
    const { manager, overlay } = makeManager({
      select: { sizeLabel: false }
    });

    dragSelection(manager);

    assert.strictEqual(sizeLabel(overlay), null);
    manager.destroy();
  });
});
