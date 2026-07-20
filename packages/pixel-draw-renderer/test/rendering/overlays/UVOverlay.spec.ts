// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { UVOverlay } from "../../../src/rendering/overlays/UVOverlay.ts";
import { UVMap } from "../../../src/uv/UVMap.ts";
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

function makeUvMap(): UVMap {
  return new UVMap({ getCanvasSize: () => {
    return { x: 64, y: 64 };
  } });
}

describe("UVOverlay — visibility follows UVMap state", () => {
  test("renders nothing for a region that isn't selected or shown", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVOverlay(svg, makeViewport(), map);

    map.create({ width: 4, height: 4 });

    assert.strictEqual(svg.querySelectorAll("rect").length, 0);
  });

  test("renders a solid border rect once its region is selected", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVOverlay(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 3, id: "r1", color: "#123456" });
    map.select(region.id);

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(rects.length, 1);
    // zoom 4, camera (0,0): rect (0,0,2,3) -> x=0, y=0, width=8, height=12
    assert.strictEqual(rects[0].getAttribute("x"), "0");
    assert.strictEqual(rects[0].getAttribute("y"), "0");
    assert.strictEqual(rects[0].getAttribute("width"), "8");
    assert.strictEqual(rects[0].getAttribute("height"), "12");
    assert.strictEqual(rects[0].getAttribute("stroke"), "#123456");
    assert.strictEqual(rects[0].hasAttribute("stroke-dasharray"), false, "solid, not dashed");
  });

  test("showAll renders every region regardless of selection", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVOverlay(svg, makeViewport(), map);

    map.create({ width: 2, height: 2 });
    map.create({ width: 2, height: 2 });
    map.showAll = true;

    assert.strictEqual(svg.querySelectorAll("rect").length, 2);
  });

  test("removes the rect once its region is deselected", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVOverlay(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 2 });
    map.select(region.id);
    assert.strictEqual(svg.querySelectorAll("rect").length, 1);

    map.select(null);
    assert.strictEqual(svg.querySelectorAll("rect").length, 0);
  });

  test("removes the rect once its region is deleted", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVOverlay(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 2 });
    map.showAll = true;
    assert.strictEqual(svg.querySelectorAll("rect").length, 1);

    map.delete(region.id);
    assert.strictEqual(svg.querySelectorAll("rect").length, 0);
  });

  test("moving a visible region updates its screen position", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVOverlay(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 2 });
    map.showAll = true;
    map.move(region.id, { x: 5, y: 5, width: 2, height: 2 });

    const rect = svg.querySelector("rect")!;
    assert.strictEqual(rect.getAttribute("x"), "20");
    assert.strictEqual(rect.getAttribute("y"), "20");
  });
});

describe("UVOverlay — setLiveOverride", () => {
  test("renders the override rect instead of the stored one", () => {
    const svg = makeSvg();
    const map = makeUvMap();
    const overlay = new UVOverlay(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 2 });
    map.showAll = true;

    overlay.setLiveOverride(region.id, { x: 9, y: 9, width: 2, height: 2 });

    const rect = svg.querySelector("rect")!;
    assert.strictEqual(rect.getAttribute("x"), "36");
    assert.strictEqual(rect.getAttribute("y"), "36");

    overlay.setLiveOverride(region.id, null);
    assert.strictEqual(rect.getAttribute("x"), "0");
  });
});

describe("UVOverlay — destroy", () => {
  test("stops reacting to UVMap events and removes its rects", () => {
    const svg = makeSvg();
    const map = makeUvMap();
    const overlay = new UVOverlay(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 2 });
    map.showAll = true;
    assert.strictEqual(svg.querySelectorAll("rect").length, 1);

    overlay.destroy();
    assert.strictEqual(svg.querySelectorAll("rect").length, 0);

    map.move(region.id, { x: 1, y: 1, width: 2, height: 2 });
    assert.strictEqual(svg.querySelectorAll("rect").length, 0);
  });
});
