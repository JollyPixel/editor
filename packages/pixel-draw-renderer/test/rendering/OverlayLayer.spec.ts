// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OverlayLayer } from "#src/rendering/OverlayLayer.ts";
import { BrushHighlightOverlay } from "#src/rendering/overlays/BrushHighlightOverlay.ts";
import { LinePreviewOverlay } from "#src/rendering/overlays/LinePreviewOverlay.ts";
import { SelectionOverlay } from "#src/rendering/overlays/SelectionOverlay.ts";
import { UVOverlay } from "#src/rendering/overlays/UVOverlay.ts";
import {
  makeViewport,
  makeBrush,
  makeUvMap
} from "../helpers/overlay.ts";
import { stubRect } from "../helpers/dom.ts";

function makeParent(): HTMLDivElement {
  // Use happy-dom's real document.body so parentElement tracking works correctly.
  const div = document.body.appendChild(document.createElement("div"));
  stubRect(div, { width: 200, height: 200 });

  return div;
}

describe("OverlayLayer", () => {
  describe("overlays", () => {
    test("exposes the brush highlight, line preview, and selection overlays", () => {
      const overlays = new OverlayLayer({
        parent: makeParent(),
        viewport: makeViewport(),
        brush: makeBrush(),
        uvMap: makeUvMap()
      });

      assert.ok(
        overlays.brushHighlight instanceof BrushHighlightOverlay,
        "brushHighlight should be an instance of BrushHighlightOverlay"
      );
      assert.ok(
        overlays.linePreview instanceof LinePreviewOverlay,
        "linePreview should be an instance of LinePreviewOverlay"
      );
      assert.ok(
        overlays.selection instanceof SelectionOverlay,
        "selection should be an instance of SelectionOverlay"
      );
      assert.ok(
        overlays.uvOverlay instanceof UVOverlay,
        "uvOverlay should be an instance of UVOverlay"
      );
    });
  });

  describe("destroy", () => {
    test("destroy() removes the SVG from parent", () => {
      const parent = makeParent();

      const overlays = new OverlayLayer({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        uvMap: makeUvMap()
      });

      // Before destroy: parent should have child SVG elements
      const childrenBefore = parent.childElementCount;
      assert.ok(
        childrenBefore > 0,
        "parent should contain the SVG element after construction"
      );

      overlays.destroy();

      const childrenAfter = parent.childElementCount;
      assert.strictEqual(
        childrenAfter,
        0,
        "SVG element should be removed after destroy()"
      );
    });

    test("destroy() can be called again without throwing", () => {
      const parent = makeParent();

      const overlays = new OverlayLayer({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        uvMap: makeUvMap()
      });

      overlays.destroy();
      assert.doesNotThrow(() => overlays.destroy());
    });
  });
});
