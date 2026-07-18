// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { LinePreviewOverlay } from "../../../src/rendering/overlays/LinePreviewOverlay.ts";
import { SVG_NS } from "../../../src/rendering/constants.ts";
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

describe("LinePreviewOverlay", () => {
  test("drawLine() shows two line elements through the pixel centers", () => {
    const svg = makeSvg();
    const overlay = new LinePreviewOverlay(svg, makeViewport(), makeBrush());

    overlay.drawLine({ x: 1, y: 1 }, { x: 2, y: 1 });

    const lines = svg.querySelectorAll("line");
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

  test("clear() hides an active preview", () => {
    const svg = makeSvg();
    const overlay = new LinePreviewOverlay(svg, makeViewport(), makeBrush());

    overlay.drawLine({ x: 0, y: 0 }, { x: 0, y: 0 });
    overlay.clear();

    const lines = svg.querySelectorAll("line");
    for (const line of lines) {
      assert.strictEqual(line.getAttribute("visibility"), "hidden");
    }
  });
});
