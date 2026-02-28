// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { UVRenderer } from "../src/UVRenderer.ts";
import { UVMap } from "../src/UVMap.ts";
import type { DefaultViewport } from "../src/types.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();
const kSvgNs = "http://www.w3.org/2000/svg";

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
});

function makeViewport(zoom = 4, camX = 0, camY = 0): DefaultViewport {
  return { zoom, camera: { x: camX, y: camY } };
}

function makeSvg(): SVGElement {
  return kEmulatedBrowserWindow.document.createElementNS(
    kSvgNs, "svg"
  ) as unknown as SVGElement;
}

function makeRenderer(uvMap?: UVMap, viewport?: DefaultViewport): UVRenderer {
  return new UVRenderer({
    svg: makeSvg(),
    uvMap: uvMap ?? new UVMap(),
    viewport: viewport ?? makeViewport(),
    textureSize: { x: 16, y: 16 }
  });
}

describe("UVRenderer", () => {
  let uvMap: UVMap;
  let renderer: UVRenderer;

  beforeEach(() => {
    uvMap = new UVMap();
    renderer = makeRenderer(uvMap);
  });

  describe("uvToSvg", () => {
    test("u=0,v=0 at default viewport maps to camera origin", () => {
      const r = makeRenderer(new UVMap(), makeViewport(4, 10, 20));
      const pos = r.uvToSvg(0, 0);
      assert.strictEqual(pos.x, 10);
      assert.strictEqual(pos.y, 20);
    });

    test("u=1,v=1 maps to camera + textureSize * zoom", () => {
      const r = makeRenderer(new UVMap(), makeViewport(4, 0, 0));
      const pos = r.uvToSvg(1, 1);
      // textureSize={16,16}, zoom=4 → 16*4=64
      assert.strictEqual(pos.x, 64);
      assert.strictEqual(pos.y, 64);
    });

    test("u=0.5 maps to half-way across the texture", () => {
      const r = makeRenderer(new UVMap(), makeViewport(4, 0, 0));
      const pos = r.uvToSvg(0.5, 0);
      assert.strictEqual(pos.x, 32);
    });
  });

  describe("svgToUV", () => {
    test("roundtrips with uvToSvg", () => {
      const r = makeRenderer(new UVMap(), makeViewport(4, 8, 12));
      const uv = { u: 0.25, v: 0.75 };
      const svgPos = r.uvToSvg(uv.u, uv.v);
      const back = r.svgToUV(svgPos.x, svgPos.y);
      assert.ok(Math.abs(back.x - uv.u) < 1e-9);
      assert.ok(Math.abs(back.y - uv.v) < 1e-9);
    });

    test("returns 0,0 for camera position when zoom > 0", () => {
      const r = makeRenderer(new UVMap(), makeViewport(4, 20, 30));
      const uv = r.svgToUV(20, 30);
      assert.ok(Math.abs(uv.x) < 1e-9);
      assert.ok(Math.abs(uv.y) < 1e-9);
    });
  });

  describe("region SVG elements lifecycle", () => {
    test("createRegion adds an SVG group", () => {
      const svg = makeSvg();
      kEmulatedBrowserWindow.document.body.appendChild(svg as any);
      const r = new UVRenderer({
        svg,
        uvMap,
        viewport: makeViewport(),
        textureSize: { x: 16, y: 16 }
      });

      uvMap.createRegion({
        label: "Face",
        u: 0, v: 0, width: 0.25, height: 0.25, color: "#f00"
      });

      const group = svg.querySelector(`[id^="uv-region-"]`);
      assert.ok(group !== null, "SVG group should be added for the region");
      r.destroy();
    });

    test("deleteRegion removes the SVG group", () => {
      const svg = makeSvg();
      kEmulatedBrowserWindow.document.body.appendChild(svg as any);
      const r = new UVRenderer({
        svg,
        uvMap,
        viewport: makeViewport(),
        textureSize: { x: 16, y: 16 }
      });

      const region = uvMap.createRegion({
        label: "Face",
        u: 0, v: 0, width: 0.25, height: 0.25, color: "#f00"
      });

      uvMap.deleteRegion(region.id);
      const group = svg.querySelector(`#uv-region-${region.id}`);
      assert.strictEqual(group, null, "SVG group should be removed after delete");
      r.destroy();
    });
  });

  describe("setDragPreview", () => {
    test("setDragPreview(null) does not throw", () => {
      assert.doesNotThrow(() => renderer.setDragPreview(null));
    });

    test("setDragPreview with data does not throw", () => {
      assert.doesNotThrow(() => renderer.setDragPreview({
        id: "__preview__",
        label: "",
        u: 0.1,
        v: 0.1,
        width: 0.2,
        height: 0.2,
        color: "#4af"
      }));
    });
  });

  describe("destroy", () => {
    test("destroy removes overlay groups from SVG", () => {
      const svg = makeSvg();
      kEmulatedBrowserWindow.document.body.appendChild(svg as any);
      const r = new UVRenderer({
        svg,
        uvMap: new UVMap(),
        viewport: makeViewport(),
        textureSize: { x: 16, y: 16 }
      });

      r.destroy();
      assert.strictEqual(
        svg.querySelector("#uv-overlay"),
        null,
        "overlay group should be removed after destroy"
      );
    });

    test("destroy can be called twice without throwing", () => {
      const svg = makeSvg();
      kEmulatedBrowserWindow.document.body.appendChild(svg as any);
      const r = new UVRenderer({
        svg,
        uvMap: new UVMap(),
        viewport: makeViewport(),
        textureSize: { x: 16, y: 16 }
      });
      r.destroy();
      assert.doesNotThrow(() => r.destroy());
    });
  });
});
