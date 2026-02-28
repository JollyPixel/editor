// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { UVInputHandler } from "../src/UVInputHandler.ts";
import { UVMap } from "../src/UVMap.ts";
import { UVRenderer } from "../src/UVRenderer.ts";
import { Viewport } from "../src/Viewport.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();
const kSvgNs = "http://www.w3.org/2000/svg";

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
});

function makeSvg(): SVGElement {
  return kEmulatedBrowserWindow.document.createElementNS(
    kSvgNs, "svg"
  ) as unknown as SVGElement;
}

function makeViewport(zoom = 4): Viewport {
  const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom });
  vp.updateCanvasSize(200, 200);
  vp.centerTexture();

  return vp;
}

function makeSetup(zoom = 4) {
  const uvMap = new UVMap();
  const viewport = makeViewport(zoom);
  const renderer = new UVRenderer({
    svg: makeSvg(),
    uvMap,
    viewport,
    textureSize: { x: 16, y: 16 }
  });
  const handler = new UVInputHandler({
    viewport,
    uvMap,
    uvRenderer: renderer,
    textureSize: { x: 16, y: 16 },
    snapping: { pixelSnap: false, edgeSnap: false }
  });

  return { uvMap, viewport, renderer, handler };
}

describe("UVInputHandler", () => {
  describe("snapUV", () => {
    test("no snapping: returns u and v unchanged", () => {
      const { handler } = makeSetup();
      const result = handler.snapUV(0.33, 0.66);
      assert.ok(Math.abs(result.x - 0.33) < 1e-9);
      assert.ok(Math.abs(result.y - 0.66) < 1e-9);
    });

    test("pixelSnap rounds to nearest pixel boundary", () => {
      const { uvMap, viewport, renderer } = makeSetup();
      const snappingHandler = new UVInputHandler({
        viewport,
        uvMap,
        uvRenderer: renderer,
        textureSize: { x: 4, y: 4 },
        snapping: { pixelSnap: true, edgeSnap: false }
      });
      // 0.33 * 4 = 1.32 → round to 1 → 1/4 = 0.25
      const result = snappingHandler.snapUV(0.33, 0.66);
      assert.ok(Math.abs(result.x - 0.25) < 1e-9);
      // 0.66 * 4 = 2.64 → round to 3 → 3/4 = 0.75
      assert.ok(Math.abs(result.y - 0.75) < 1e-9);
      snappingHandler.destroy();
    });

    test("edgeSnap snaps to a nearby region edge", () => {
      const { uvMap, viewport, renderer } = makeSetup();
      uvMap.add({ label: "A", u: 0.5, v: 0.5, width: 0.25, height: 0.25, color: "#f00" });

      const snappingHandler = new UVInputHandler({
        viewport,
        uvMap,
        uvRenderer: renderer,
        textureSize: { x: 16, y: 16 },
        snapping: { pixelSnap: false, edgeSnap: true, edgeSnapThreshold: 0.05 }
      });
      // 0.51 is within 0.05 of 0.5 → should snap to 0.5
      const result = snappingHandler.snapUV(0.51, 0.51);
      assert.ok(Math.abs(result.x - 0.5) < 1e-9, `expected 0.5 got ${result.x}`);
      snappingHandler.destroy();
    });
  });

  describe("hitTestHandle", () => {
    test("returns null when no region is selected", () => {
      const { handler } = makeSetup();
      assert.strictEqual(handler.hitTestHandle(0, 0), null);
    });

    test("returns null when selected region has no handle at given canvas position", () => {
      const { uvMap, handler } = makeSetup();
      const region = uvMap.add({ label: "A", u: 0, v: 0, width: 0.5, height: 0.5, color: "#f00" });
      uvMap.select(region.id);

      // The handle for corner-br is at uvToSvg(0.5, 0.5)
      // We test at a position far away from all handles
      assert.strictEqual(handler.hitTestHandle(0, 0), null);
    });

    test("returns handle when mouse is near corner-tl of selected region", () => {
      const { uvMap, handler, renderer } = makeSetup(10);
      // zoom=10, camX=camY=centerTexture offset
      // Add a region at u=0, v=0
      const region = uvMap.add({
        label: "A", u: 0, v: 0, width: 0.5, height: 0.5, color: "#f00"
      });
      uvMap.select(region.id);

      // corner-tl is at uvToSvg(0, 0) = { x: camX + 0, y: camY + 0 }
      const svgPos = renderer.uvToSvg(0, 0);
      const handle = handler.hitTestHandle(svgPos.x, svgPos.y);
      assert.ok(handle !== null, "Should detect corner-tl handle");
      assert.strictEqual(handle!.type, "corner-tl");
      assert.strictEqual(handle!.regionId, region.id);
    });
  });

  describe("hitTestRegion", () => {
    test("returns null when no regions exist", () => {
      const { handler, renderer } = makeSetup(4);
      // Convert the center to canvas space and test
      const { x: cx, y: cy } = renderer.uvToSvg(0.5, 0.5);
      assert.strictEqual(handler.hitTestRegion(cx, cy), null);
    });

    test("returns region id when cursor is inside a region", () => {
      const { uvMap, handler, renderer } = makeSetup(4);
      const region = uvMap.add({
        label: "Face", u: 0.1, v: 0.1, width: 0.5, height: 0.5, color: "#f00"
      });

      // Center of region at u=0.35, v=0.35
      const svgPos = renderer.uvToSvg(0.35, 0.35);
      const found = handler.hitTestRegion(svgPos.x, svgPos.y);
      assert.strictEqual(found, region.id);
    });

    test("returns null when cursor is outside all regions", () => {
      const { uvMap, handler, renderer } = makeSetup(4);
      uvMap.add({ label: "Face", u: 0.1, v: 0.1, width: 0.2, height: 0.2, color: "#f00" });

      // Outside the region
      const svgPos = renderer.uvToSvg(0.9, 0.9);
      assert.strictEqual(handler.hitTestRegion(svgPos.x, svgPos.y), null);
    });
  });

  describe("state machine — creating", () => {
    test("drag on empty space then mouseup creates a region", () => {
      const { uvMap, handler, renderer } = makeSetup(4);

      const start = renderer.uvToSvg(0.1, 0.1);
      const end = renderer.uvToSvg(0.4, 0.4);

      handler.onMouseDown(start.x, start.y, 0);
      handler.onMouseMove(end.x, end.y);
      handler.onMouseUp();

      assert.strictEqual(uvMap.size, 1);
    });

    test("tiny drag (smaller than minSize) does not create a region", () => {
      const { uvMap, handler, renderer } = makeSetup(4);

      const start = renderer.uvToSvg(0.1, 0.1);
      // Only 0.001 units wide — below kMinRegionSize (0.01)
      const end = renderer.uvToSvg(0.1005, 0.1005);

      handler.onMouseDown(start.x, start.y, 0);
      handler.onMouseMove(end.x, end.y);
      handler.onMouseUp();

      assert.strictEqual(uvMap.size, 0, "region below minSize should not be created");
    });
  });

  describe("state machine — moving", () => {
    test("mousedown on region starts moving, mousemove changes position", () => {
      const { uvMap, handler, renderer } = makeSetup(4);
      const region = uvMap.add({
        label: "A", u: 0.2, v: 0.2, width: 0.3, height: 0.3, color: "#f00"
      });
      uvMap.select(region.id);

      const initialU = region.u;
      const initialV = region.v;

      // Click on center of region
      const center = renderer.uvToSvg(0.35, 0.35);
      const target = renderer.uvToSvg(0.45, 0.45);

      handler.onMouseDown(center.x, center.y, 0);
      handler.onMouseMove(target.x, target.y);
      handler.onMouseUp();

      assert.ok(region.u !== initialU || region.v !== initialV, "region should have moved");
    });
  });

  describe("onDeleteKey", () => {
    test("deletes selected region", () => {
      const { uvMap, handler } = makeSetup();
      const region = uvMap.add({
        label: "A", u: 0, v: 0, width: 0.25, height: 0.25, color: "#f00"
      });
      uvMap.select(region.id);
      handler.onDeleteKey();
      assert.strictEqual(uvMap.size, 0);
    });

    test("does nothing when no region is selected", () => {
      const { uvMap, handler } = makeSetup();
      uvMap.add({ label: "A", u: 0, v: 0, width: 0.25, height: 0.25, color: "#f00" });
      // No selection
      assert.doesNotThrow(() => handler.onDeleteKey());
      assert.strictEqual(uvMap.size, 1, "non-selected region should remain");
    });
  });

  describe("destroy", () => {
    test("destroy does not throw", () => {
      const { handler } = makeSetup();
      assert.doesNotThrow(() => handler.destroy());
    });
  });
});
