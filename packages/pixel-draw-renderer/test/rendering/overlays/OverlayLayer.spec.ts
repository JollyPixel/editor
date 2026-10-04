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

      overlays.brushHighlight.update(20, 20, () => 1);
      const region = uvMap.create({
        width: 4,
        height: 4
      });
      uvMap.select(region.id);

      assert.deepStrictEqual(
        [...svg.children].map((layer) => layer.getAttribute("data-layer")),
        ["uv", "peer-selections", "brush", "line", "selection", "peer-cursors"]
      );
      assert.ok(svg.firstElementChild?.querySelector("[data-overlay=uv]"));
    });

    test("keeps a peer outline in its own layer after it re-renders", () => {
      const parent = makeParent();
      const overlays = new OverlayLayer({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        uvMap: makeUvMap({ x: 64, y: 64 })
      });

      overlays.peerSelectionOutlines.set("peer-A", {
        rect: { x: 0, y: 0, width: 2, height: 2 },
        mask: null,
        color: "#f00"
      });
      overlays.peerSelectionOutlines.refresh();
      overlays.peerCursors.set("peer-A", { pos: { x: 1, y: 1 }, color: "#f00" });
      overlays.peerSelectionOutlines.refresh();

      const svg = parent.querySelector("svg");
      assert.ok(svg?.querySelector("[data-layer=peer-selections] > path"));
      assert.strictEqual(svg?.lastElementChild?.getAttribute("data-layer"), "peer-cursors");
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
