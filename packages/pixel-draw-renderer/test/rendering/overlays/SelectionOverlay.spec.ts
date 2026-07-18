// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { SelectionOverlay } from "../../../src/rendering/overlays/SelectionOverlay.ts";
import { SVG_NS } from "../../../src/rendering/constants.ts";
import { Zoom } from "../../../src/rendering/Zoom.ts";
import type { DefaultViewport } from "../../../src/rendering/Viewport.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
});

function makeSvg(): SVGElement {
  return kEmulatedBrowserWindow.document.createElementNS(SVG_NS, "svg") as unknown as SVGElement;
}

function makeViewport(): DefaultViewport {
  return {
    zoom: new Zoom({ default: 4 }),
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

describe("SelectionOverlay", () => {
  test("drawRect() shows a dashed outline+inline rect pair in screen space", () => {
    const svg = makeSvg();
    const overlay = new SelectionOverlay(svg, makeViewport(), makeBrush());

    // zoom 4, camera (0,0): rect (1,1,2,3) -> x=4, y=4, width=8, height=12
    overlay.drawRect({ x: 1, y: 1, width: 2, height: 3 });

    const rects = svg.querySelectorAll("rect");
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

  test("clear() hides the selection rect", () => {
    const svg = makeSvg();
    const overlay = new SelectionOverlay(svg, makeViewport(), makeBrush());

    overlay.drawRect({ x: 0, y: 0, width: 1, height: 1 });
    overlay.clear();

    const rects = svg.querySelectorAll("rect");
    for (const rect of rects) {
      assert.strictEqual(rect.getAttribute("visibility"), "hidden");
    }
  });
});
