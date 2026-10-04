// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "#src/rendering/Viewport.ts";

describe("Viewport framing", () => {
  describe("centerTexture", () => {
    test("centers camera within canvas", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();

      assert.strictEqual(vp.camera.x, 40);
      assert.strictEqual(vp.camera.y, 30);
    });

    test("anchors an overflowing texture to the top-left corner", () => {
      const vp = new Viewport({
        textureSize: {
          x: 100,
          y: 100
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 8, y: 8 }
      );
    });

    test("anchors only the axis the texture overflows", () => {
      const vp = new Viewport({
        textureSize: {
          x: 100,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 8, y: 30 }
      );
    });

    test("anchors a texture that only fits without padding", () => {
      const vp = new Viewport({
        textureSize: {
          x: 45,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();

      assert.strictEqual(vp.camera.x, 8);
    });
  });

  describe("resizeCanvas", () => {
    test("keeps a fitting texture centered", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      vp.resizeCanvas(120, 60);

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 50, y: 20 }
      );
    });

    test("keeps an overflowing texture anchored to the top-left corner", () => {
      const vp = new Viewport({
        textureSize: {
          x: 100,
          y: 100
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      vp.resizeCanvas(120, 60);

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 8, y: 8 }
      );
    });

    test("anchors only the axis the texture overflows", () => {
      const vp = new Viewport({
        textureSize: {
          x: 100,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      vp.resizeCanvas(120, 60);

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 8, y: 20 }
      );
    });

    test("reframes an axis when the texture starts fitting", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 50
        },
        zoom: 1
      });
      vp.updateCanvasSize(100, 40);
      vp.centerTexture();
      vp.resizeCanvas(100, 80);

      assert.strictEqual(vp.camera.y, 15);
    });

    test("reframes an axis when the texture stops fitting", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 50
        },
        zoom: 1
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      vp.resizeCanvas(100, 40);

      assert.strictEqual(vp.camera.y, 8);
    });

    test("returns to the same frame after growing and shrinking back", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 50
        },
        zoom: 1
      });
      vp.updateCanvasSize(100, 40);
      vp.centerTexture();
      const before = { ...vp.camera };
      vp.resizeCanvas(100, 80);
      vp.resizeCanvas(100, 40);

      assert.deepStrictEqual({ ...vp.camera }, before);
    });

    test("keeps a pan offset while the texture keeps fitting", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 80);
      vp.centerTexture();
      vp.applyPan(5, -5);
      vp.resizeCanvas(120, 60);

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 55, y: 15 }
      );
    });

    test("frames the texture on the first sizing of a hidden canvas", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 100
        },
        zoom: 2
      });
      vp.centerTexture();
      vp.resizeCanvas(100, 80);

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 40, y: 8 }
      );
    });
  });
});
