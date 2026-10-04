// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "#src/rendering/Viewport.ts";

describe("Viewport framing", () => {
  describe("texture resize", () => {
    test("anchors a texture that grows past the canvas to the top-left corner", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 100);
      vp.centerTexture();
      vp.texture.resize({
        x: 100,
        y: 100
      });

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 8, y: 8 }
      );
    });

    test("centers a texture that shrinks to fit the canvas", () => {
      const vp = new Viewport({
        textureSize: {
          x: 100,
          y: 100
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 100);
      vp.centerTexture();
      vp.texture.resize({
        x: 10,
        y: 10
      });

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 40, y: 40 }
      );
    });

    test("keeps a fitting texture centered", () => {
      const vp = new Viewport({
        textureSize: {
          x: 10,
          y: 10
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 100);
      vp.centerTexture();
      vp.texture.resize({
        x: 20,
        y: 30
      });

      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 30, y: 20 }
      );
    });

    test("emits changed only when the camera moves", () => {
      const vp = new Viewport({
        textureSize: {
          x: 100,
          y: 100
        },
        zoom: 2
      });
      vp.updateCanvasSize(100, 100);
      vp.centerTexture();
      let count = 0;
      vp.on("changed", () => {
        count++;
      });

      vp.texture.resize({
        x: 120,
        y: 120
      });
      assert.deepStrictEqual(
        { ...vp.camera },
        { x: 8, y: 8 }
      );
      assert.strictEqual(count, 0);

      vp.texture.resize({
        x: 10,
        y: 10
      });
      assert.strictEqual(count, 1);
    });
  });
});
