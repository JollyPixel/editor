// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OverlayLayer } from "#src/rendering/overlays/OverlayLayer.ts";
import { BrushHighlightView } from "#src/rendering/overlays/BrushHighlight.ts";
import { LinePreview } from "#src/rendering/overlays/LinePreview.ts";
import { SelectionOutline } from "#src/rendering/overlays/SelectionOutline.ts";
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import {
  makeViewport,
  makeBrush,
  makeUvMap
} from "../../helpers/overlay.ts";
import { stubRect } from "../../helpers/dom.ts";

function makeParent(): HTMLDivElement {
  // Use happy-dom's real document.body so parentElement tracking works correctly.
  const div = document.body.appendChild(
    document.createElement("div")
  );
  stubRect(div, {
    width: 200,
    height: 200
  });

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
        overlays.brushHighlight instanceof BrushHighlightView,
        "brushHighlight should be an instance of BrushHighlightView"
      );
      assert.ok(
        overlays.linePreview instanceof LinePreview,
        "linePreview should be an instance of LinePreview"
      );
      assert.ok(
        overlays.selection instanceof SelectionOutline,
        "selection should be an instance of SelectionOutline"
      );
      assert.ok(
        overlays.uvOverlay instanceof UVRegionLayer,
        "uvOverlay should be an instance of UVRegionLayer"
      );
    });

    test("keeps tool overlays above the UV layer", () => {
      const parent = makeParent();
      const uvMap = makeUvMap();
      const overlays = new OverlayLayer({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        uvMap
      });
      const svg = parent.querySelector("svg")!;

      overlays.brushHighlight.update(20, 20);
      const region = uvMap.create({
        width: 4,
        height: 4
      });
      uvMap.select(region.id);

      assert.strictEqual(
        svg.firstElementChild?.getAttribute("data-overlay"),
        "uv"
      );
      assert.notStrictEqual(
        svg.lastElementChild?.getAttribute("data-overlay"),
        "uv",
        "a tool overlay must paint after the UV layer"
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
