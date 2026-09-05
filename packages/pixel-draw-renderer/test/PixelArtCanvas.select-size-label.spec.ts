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
import { mouseEvent } from "./helpers/events.ts";

describe("PixelArtCanvas — selection size label", () => {
  let container: HTMLDivElement;
  // Appended in order: the interactive canvas, then the SVG overlay.
  let appended: HTMLCanvasElement[];

  beforeEach(() => {
    ({ container, children: appended } = makeContainer());
  });

  // 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
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

  function sizeLabel(): Element | null {
    return appended[1].querySelector(
      "[data-overlay='selection-size']"
    );
  }

  function dragSelection(
    manager: PixelArtCanvas
  ): void {
    const canvas = manager.canvas();

    manager.mode = "select";
    // client 92..100 -> texture (2,2)..(4,4), a 3x3 selection.
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
  }

  test("a dragged selection shows its size, and deselecting hides it", () => {
    const manager = makeManager();

    dragSelection(manager);

    assert.strictEqual(sizeLabel()?.textContent, "3×3");
    assert.strictEqual(
      sizeLabel()?.getAttribute("visibility"),
      "visible"
    );

    // Leaving select mode deselects.
    manager.mode = "paint";

    assert.strictEqual(
      sizeLabel()?.getAttribute("visibility"),
      "hidden"
    );
    manager.destroy();
  });

  test("select.sizeLabel: false renders no label", () => {
    const manager = makeManager({
      select: { sizeLabel: false }
    });

    dragSelection(manager);

    assert.strictEqual(sizeLabel(), null);
    manager.destroy();
  });
});
