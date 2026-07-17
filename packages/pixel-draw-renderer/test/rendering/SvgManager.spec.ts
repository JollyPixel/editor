// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { SvgManager } from "../../src/rendering/SvgManager.ts";
import type { DefaultViewport } from "../../src/types.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
});

function makeParent(): HTMLDivElement {
  // Use happy-dom's real document.body so parentElement tracking works correctly.
  const div = kEmulatedBrowserWindow.document.body.appendChild(
    kEmulatedBrowserWindow.document.createElement("div")
  ) as unknown as HTMLDivElement;
  (div as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };

  return div;
}

function makeViewport(): DefaultViewport {
  return {
    zoom: 4,
    camera: { x: 0, y: 0 }
  };
}

function makeBrush() {
  return {
    get size() {
      return 1;
    },
    get colorInline() {
      return "#FFF";
    },
    get colorOutline() {
      return "#000";
    }
  };
}

describe("SvgManager", () => {
  describe("destroy", () => {
    test("destroy() removes the SVG from parent", () => {
      const parent = makeParent();

      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 16, y: 16 }
      });

      // Before destroy: parent should have child SVG elements
      const childrenBefore = parent.childElementCount;
      assert.ok(childrenBefore > 0, "parent should contain the SVG element after construction");

      svgMgr.destroy();

      const childrenAfter = parent.childElementCount;
      assert.strictEqual(childrenAfter, 0, "SVG element should be removed after destroy()");
    });

    test("destroy() can be called again without throwing", () => {
      const parent = makeParent();

      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 8, y: 8 }
      });

      svgMgr.destroy();
      assert.doesNotThrow(() => svgMgr.destroy());
    });
  });

  describe("setPreviewLine / clearPreviewLine", () => {
    test("setPreviewLine() shows two line elements through the pixel centers", () => {
      const parent = makeParent();
      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 16, y: 16 }
      });

      svgMgr.setPreviewLine({ x: 1, y: 1 }, { x: 2, y: 1 });

      const lines = parent.querySelectorAll("line");
      assert.strictEqual(lines.length, 2, "one outline line + one inline line");
      for (const line of lines) {
        assert.strictEqual(line.getAttribute("visibility"), "visible");
        // zoom 4, camera (0,0): center of (1,1) -> (6,6), center of (2,1) -> (10,6)
        assert.strictEqual(line.getAttribute("x1"), "6");
        assert.strictEqual(line.getAttribute("y1"), "6");
        assert.strictEqual(line.getAttribute("x2"), "10");
        assert.strictEqual(line.getAttribute("y2"), "6");
      }
    });

    test("clearPreviewLine() hides an active preview", () => {
      const parent = makeParent();
      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 16, y: 16 }
      });

      svgMgr.setPreviewLine({ x: 0, y: 0 }, { x: 0, y: 0 });
      svgMgr.clearPreviewLine();

      const lines = parent.querySelectorAll("line");
      for (const line of lines) {
        assert.strictEqual(line.getAttribute("visibility"), "hidden");
      }
    });
  });

  describe("setSelectionRect / clearSelectionRect", () => {
    test("setSelectionRect() shows a dashed outline+inline rect pair in screen space", () => {
      const parent = makeParent();
      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 16, y: 16 }
      });

      // zoom 4, camera (0,0): rect (1,1,2,3) -> x=4, y=4, width=8, height=12
      svgMgr.setSelectionRect({ x: 1, y: 1, width: 2, height: 3 });

      // The brush highlight also uses two <rect> elements — isolate the
      // dashed selection ones by their stroke-dasharray.
      const rects = [...parent.querySelectorAll("rect")].filter((el) => el.hasAttribute("stroke-dasharray"));
      assert.strictEqual(rects.length, 2, "one outline rect + one inline rect");
      for (const rect of rects) {
        assert.strictEqual(rect.getAttribute("visibility"), "visible");
        assert.strictEqual(rect.getAttribute("x"), "4");
        assert.strictEqual(rect.getAttribute("y"), "4");
        assert.strictEqual(rect.getAttribute("width"), "8");
        assert.strictEqual(rect.getAttribute("height"), "12");
        assert.ok(rect.getAttribute("stroke-dasharray"), "should be dashed");
      }
    });

    test("clearSelectionRect() hides the selection rect", () => {
      const parent = makeParent();
      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 16, y: 16 }
      });

      svgMgr.setSelectionRect({ x: 0, y: 0, width: 1, height: 1 });
      svgMgr.clearSelectionRect();

      const rects = [...parent.querySelectorAll("rect")].filter((el) => el.hasAttribute("stroke-dasharray"));
      for (const rect of rects) {
        assert.strictEqual(rect.getAttribute("visibility"), "hidden");
      }
    });
  });
});
