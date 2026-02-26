// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "../src/Viewport.ts";

describe("Viewport", () => {
  describe("constructor", () => {
    test("throws when zoomMax < zoomMin", () => {
      assert.throws(
        () => new Viewport({ textureSize: { x: 16, y: 16 }, zoomMin: 4, zoomMax: 2 }),
        /Max zoom.*can't be under min zoom/
      );
    });

    test("clamps initial zoom to [min, max]", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 100, zoomMin: 1, zoomMax: 32 });
      assert.strictEqual(vp.zoom, 32);
    });

    test("defaults zoom to 4", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 } });
      assert.strictEqual(vp.zoom, 4);
    });
  });

  describe("getTexturePixelSize", () => {
    test("returns textureSize * zoom", () => {
      const vp = new Viewport({ textureSize: { x: 10, y: 20 }, zoom: 3 });
      assert.deepStrictEqual(vp.getTexturePixelSize(), { x: 30, y: 60 });
    });
  });

  describe("centerTexture", () => {
    test("centers camera within canvas", () => {
      const vp = new Viewport({ textureSize: { x: 10, y: 10 }, zoom: 2 });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      assert.strictEqual(vp.camera.x, 40);
      assert.strictEqual(vp.camera.y, 30);
    });
  });

  describe("clampCamera", () => {
    test("prevents camera from going past negative bound", () => {
      const vp = new Viewport({ textureSize: { x: 8, y: 8 }, zoom: 4 });
      vp.updateCanvasSize(100, 100);
      // Texture is 32x32 px; margin = 4; minX = -32+4 = -28
      vp.applyPan(-10000, 0);
      assert.ok(vp.camera.x >= -28, `camera.x ${vp.camera.x} should be >= -28`);
    });

    test("prevents camera from going past positive bound", () => {
      const vp = new Viewport({ textureSize: { x: 8, y: 8 }, zoom: 4 });
      vp.updateCanvasSize(100, 100);
      // maxX = 100-4 = 96
      vp.applyPan(10000, 0);
      assert.ok(vp.camera.x <= 96, `camera.x ${vp.camera.x} should be <= 96`);
    });
  });

  describe("applyZoom", () => {
    test("zooms in (negative delta increases zoom)", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
      vp.updateCanvasSize(200, 200);
      const before = vp.zoom;
      vp.applyZoom(-1, 100, 100);
      assert.ok(vp.zoom > before, `zoom ${vp.zoom} should be greater than ${before}`);
    });

    test("zooms out (positive delta decreases zoom)", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
      vp.updateCanvasSize(200, 200);
      const before = vp.zoom;
      vp.applyZoom(1, 100, 100);
      assert.ok(vp.zoom < before, `zoom ${vp.zoom} should be less than ${before}`);
    });

    test("clamps zoom to zoomMin", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 1, zoomMin: 1 });
      vp.updateCanvasSize(200, 200);
      vp.applyZoom(100, 100, 100);
      assert.strictEqual(vp.zoom, 1);
    });

    test("clamps zoom to zoomMax", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 32, zoomMax: 32 });
      vp.updateCanvasSize(200, 200);
      vp.applyZoom(-100, 100, 100);
      assert.strictEqual(vp.zoom, 32);
    });
  });

  describe("applyPan", () => {
    test("moves camera by delta", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 1 });
      vp.updateCanvasSize(500, 500);
      vp.centerTexture();
      const beforeX = vp.camera.x;
      const beforeY = vp.camera.y;
      vp.applyPan(10, 5);
      assert.strictEqual(vp.camera.x, beforeX + 10);
      assert.strictEqual(vp.camera.y, beforeY + 5);
    });
  });

  describe("getMouseCanvasPosition", () => {
    test("subtracts bounding rect left/top", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 } });
      const bounds = { left: 50, top: 30 } as DOMRect;
      const pos = vp.getMouseCanvasPosition(150, 80, bounds);
      assert.strictEqual(pos.x, 100);
      assert.strictEqual(pos.y, 50);
    });
  });

  describe("getMouseTexturePosition", () => {
    test("converts canvas coords to texture coords", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
      vp.updateCanvasSize(200, 200);
      vp.centerTexture();
      // camera should be (200/2 - 16*4/2) = 100-32 = 68
      const bounds = { left: 0, top: 0, right: 200, bottom: 200 } as DOMRect;
      // mouseX=68 → canvasX=68 → textureX = (68 - camera.x) / zoom = 0
      const pos = vp.getMouseTexturePosition(vp.camera.x, vp.camera.y, { bounds });
      assert.ok(pos !== null);
      assert.strictEqual(pos!.x, 0);
      assert.strictEqual(pos!.y, 0);
    });

    test("returns null when limit=true and position is out of texture bounds", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
      vp.updateCanvasSize(200, 200);
      const bounds = { left: 0, top: 0 } as DOMRect;
      const pos = vp.getMouseTexturePosition(-1000, -1000, { bounds, limit: true });
      assert.strictEqual(pos, null);
    });

    test("returns coords when limit=false even if out of bounds", () => {
      const vp = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
      vp.updateCanvasSize(200, 200);
      const bounds = { left: 0, top: 0 } as DOMRect;
      const pos = vp.getMouseTexturePosition(-1000, -1000, { bounds, limit: false });
      assert.ok(pos !== null);
    });
  });

  describe("setTextureSize", () => {
    test("updates texture pixel size after change", () => {
      const vp = new Viewport({ textureSize: { x: 8, y: 8 }, zoom: 2 });
      vp.setTextureSize({ x: 16, y: 32 });
      assert.deepStrictEqual(vp.getTexturePixelSize(), { x: 32, y: 64 });
    });
  });
});
