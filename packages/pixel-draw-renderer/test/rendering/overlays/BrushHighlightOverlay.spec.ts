// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { BrushHighlightOverlay } from "../../../src/rendering/overlays/BrushHighlightOverlay.ts";
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

function makeBrush(size: number) {
  return {
    get size() {
      return size;
    },
    get colorInline() {
      return "#FFF";
    },
    get colorOutline() {
      return "#000";
    }
  };
}

describe("BrushHighlightOverlay", () => {
  test("update() shows the highlight group at the grid-snapped position", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightOverlay(svg, makeViewport(), makeBrush(1));

    overlay.update(10, 10);

    const group = svg.querySelector("g");
    assert.ok(group, "highlight group should exist");
    assert.strictEqual(group!.getAttribute("visibility"), "visible");
    assert.ok(group!.getAttribute("transform")?.includes("scale(4)"), "odd brush size scales by zoom");
  });

  test("update(null, null) hides the highlight", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightOverlay(svg, makeViewport(), makeBrush(1));

    overlay.update(10, 10);
    overlay.update(null, null);

    const group = svg.querySelector("g");
    assert.strictEqual(group!.getAttribute("visibility"), "hidden");
  });

  test("hide() hides the highlight", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightOverlay(svg, makeViewport(), makeBrush(1));

    overlay.update(10, 10);
    overlay.hide();

    const group = svg.querySelector("g");
    assert.strictEqual(group!.getAttribute("visibility"), "hidden");
  });
});
