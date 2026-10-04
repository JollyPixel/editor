// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OverlayLayer } from "#src/rendering/overlays/OverlayLayer.ts";
import {
  makeViewport,
  makeBrush
} from "../../helpers/overlay.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";
import { stubRect } from "../../helpers/dom.ts";

function makeParent(): HTMLDivElement {
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
    test("keeps tool overlays above the UV layer", () => {
      const parent = makeParent();
      const uvMap = makeUvMap({ x: 64, y: 64 });
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
        uvMap: makeUvMap({ x: 64, y: 64 })
      });

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
  });
});
