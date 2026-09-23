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

  describe("textureClientPosition", () => {
    const bounds = {
      left: 40,
      top: 25
    };

    function roundTrip(
      vp: Viewport,
      point: { x: number; y: number; }
    ) {
      const client = vp.textureClientPosition(point, bounds);

      return vp.mouseTexturePosition(
        client.x,
        client.y,
        { bounds: bounds as DOMRect }
      );
    }

    test("returns the centre of the texel in client coordinates", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4
      });
      vp.updateCanvasSize(200, 200);
      vp.centerTexture();

      assert.deepStrictEqual(
        vp.textureClientPosition({ x: 2, y: 3 }, bounds),
        {
          x: 40 + vp.camera.x + 10,
          y: 25 + vp.camera.y + 14
        }
      );
    });

    test("round-trips with mouseTexturePosition across zoom levels and pans", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 7, y: 11 },
        { x: 15, y: 15 }
      ];
      for (const zoom of [1, 3, 8, 32]) {
        const vp = new Viewport({
          textureSize: {
            x: 16,
            y: 16
          },
          zoom,
          zoomMax: 32
        });
        vp.updateCanvasSize(300, 200);
        vp.centerTexture();

        for (const pan of [{ x: 0, y: 0 }, { x: 13, y: -7 }, { x: -40, y: 22 }]) {
          vp.applyPan(pan.x, pan.y);
          for (const point of points) {
            assert.deepStrictEqual(roundTrip(vp, point), point);
          }
        }
      }
    });

    test("round-trips at a fractional zoom mid-animation", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4
      });
      vp.updateCanvasSize(200, 200);
      vp.centerTexture();
      vp.applyZoom(-300, 100, 100);
      vp.update(10);

      assert.ok(!Number.isInteger(vp.zoom.value));
      assert.deepStrictEqual(roundTrip(vp, { x: 5, y: 9 }), { x: 5, y: 9 });
    });
  });
});
