// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "#src/rendering/Viewport.ts";

describe("Viewport coordinates", () => {
  describe("visibleCenter", () => {
    test("returns the texture pixel under the middle of the canvas", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();

      assert.deepStrictEqual(
        vp.visibleCenter(),
        { x: 5, y: 5 }
      );
    });

    test("follows the camera when the texture is panned off centre", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      // Pushing the texture right moves the visible centre left over it.
      vp.applyPan(6, 0);

      assert.deepStrictEqual(
        vp.visibleCenter(),
        { x: 2, y: 5 }
      );
    });

    test("clamps to the texture when the centre falls outside it", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      vp.applyPan(1000, -1000);

      assert.deepStrictEqual(
        vp.visibleCenter(),
        { x: 0, y: 9 }
      );
    });
  });

  describe("mouseCanvasPosition", () => {
    test("subtracts bounding rect left/top", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        }
      });

      const bounds = { left: 50, top: 30 } as DOMRect;
      const pos = vp.mouseCanvasPosition(
        150,
        80,
        bounds
      );

      assert.strictEqual(pos.x, 100);
      assert.strictEqual(pos.y, 50);
    });
  });

  describe("mouseTexturePosition", () => {
    test("converts canvas coords to texture coords", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4
      });
      vp.updateCanvasSize(200, 200);
      vp.centerTexture();

      // camera should be (200/2 - 16*4/2) = 100-32 = 68
      const bounds = {
        left: 0,
        top: 0,
        right: 200,
        bottom: 200
      } as DOMRect;
      // mouseX=68 → canvasX=68 → textureX = (68 - camera.x) / zoom = 0
      const pos = vp.mouseTexturePosition(
        vp.camera.x,
        vp.camera.y,
        { bounds }
      );

      assert.ok(pos !== null);
      assert.strictEqual(pos!.x, 0);
      assert.strictEqual(pos!.y, 0);
    });

    test("returns null when limit=true and position is out of texture bounds", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4
      });

      vp.updateCanvasSize(200, 200);
      const bounds = {
        left: 0,
        top: 0
      } as DOMRect;
      const pos = vp.mouseTexturePosition(
        -1000,
        -1000,
        { bounds, limit: true }
      );

      assert.strictEqual(pos, null);
    });

    test("returns coords when limit=false even if out of bounds", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4
      });
      vp.updateCanvasSize(200, 200);
      const bounds = { left: 0, top: 0 } as DOMRect;
      const pos = vp.mouseTexturePosition(
        -1000,
        -1000,
        { bounds, limit: false }
      );

      assert.ok(pos !== null);
    });
  });
});
