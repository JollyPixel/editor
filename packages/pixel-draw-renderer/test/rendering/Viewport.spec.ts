// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "#src/rendering/Viewport.ts";

describe("Viewport", () => {
  describe("constructor", () => {
    test("forwards zoom options to its Zoom", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 6,
        zoomMin: 2,
        zoomMax: 12,
        zoomSensitivity: 0.5,
        zoomSmoothing: 0
      });

      assert.strictEqual(vp.zoom.value, 6);
      assert.strictEqual(vp.zoom.min, 2);
      assert.strictEqual(vp.zoom.max, 12);
      assert.strictEqual(vp.zoom.sensitivity, 0.5);
      assert.strictEqual(vp.zoom.smoothing, 0);
      assert.throws(
        () => new Viewport({
          textureSize: {
            x: 16,
            y: 16
          },
          zoomMin: 4,
          zoomMax: 2
        }),
        /Max zoom.*can't be under min zoom/
      );
    });
  });

  describe("clampCamera", () => {
    test("stops the camera one zoom step inside the left edge", () => {
      const vp = new Viewport({
        textureSize: {
          x: 8,
          y: 8
        },
        zoom: 4
      });
      vp.updateCanvasSize(100, 100);
      vp.applyPan(-10000, 0);

      assert.strictEqual(vp.camera.x, -28);
    });

    test("stops the camera one zoom step inside the right edge", () => {
      const vp = new Viewport({
        textureSize: {
          x: 8,
          y: 8
        },
        zoom: 4
      });
      vp.updateCanvasSize(100, 100);
      vp.applyPan(10000, 0);

      assert.strictEqual(vp.camera.x, 96);
    });
  });

  describe("applyZoom", () => {
    test("zooms in on a negative delta and keeps the pixel under the pointer fixed", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4,
        zoomSmoothing: 0
      });
      vp.updateCanvasSize(200, 200);
      vp.centerTexture();
      const bounds = {
        left: 0,
        top: 0
      } as DOMRect;
      const pixelBefore = vp.mouseTexturePosition(102, 102, { bounds });
      vp.applyZoom(-100, 102, 102);

      assert.ok(
        vp.zoom.value > 4,
        `zoom ${vp.zoom.value} should be greater than 4`
      );
      assert.deepStrictEqual(pixelBefore, { x: 8, y: 8 });
      assert.deepStrictEqual(
        vp.mouseTexturePosition(102, 102, { bounds }),
        pixelBefore
      );
    });
  });

  describe("applyPan", () => {
    test("moves camera by delta", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 1
      });
      vp.updateCanvasSize(500, 500);
      vp.centerTexture();
      const beforeX = vp.camera.x;
      const beforeY = vp.camera.y;
      vp.applyPan(10, 5);

      assert.strictEqual(
        vp.camera.x,
        beforeX + 10
      );
      assert.strictEqual(
        vp.camera.y,
        beforeY + 5
      );
    });
  });

  describe("changed signal", () => {
    function makeViewport(): Viewport {
      const vp = new Viewport({
        textureSize: { x: 16, y: 16 },
        zoom: 4
      });
      vp.updateCanvasSize(100, 100);

      return vp;
    }

    function countChanges(
      vp: Viewport
    ): () => number {
      let count = 0;
      vp.on("changed", () => {
        count++;
      });

      return () => count;
    }

    test("emits once per applyPan", () => {
      const vp = makeViewport();
      const changes = countChanges(vp);

      vp.applyPan(5, 5);

      assert.strictEqual(changes(), 1);
    });

    test("emits once per applyZoom without smoothing", () => {
      const vp = makeViewport();
      vp.zoom.smoothing = 0;
      const changes = countChanges(vp);

      vp.applyZoom(100, 50, 50);

      assert.strictEqual(changes(), 1);
    });

    test("emits animating once per eased zoom and changed once per update", () => {
      const vp = makeViewport();
      const changes = countChanges(vp);
      let animating = 0;
      vp.on("animating", () => {
        animating++;
      });

      vp.applyZoom(-100, 50, 50);
      vp.applyZoom(-100, 50, 50);
      assert.strictEqual(animating, 1);
      assert.strictEqual(changes(), 0);

      vp.update(16);
      assert.strictEqual(changes(), 1);
    });

    test("does not emit from update at rest", () => {
      const vp = makeViewport();
      const changes = countChanges(vp);

      assert.strictEqual(vp.update(16), false);
      assert.strictEqual(changes(), 0);
    });

    test("emits once per resizeCanvas", () => {
      const vp = makeViewport();
      const changes = countChanges(vp);

      vp.resizeCanvas(200, 200);

      assert.strictEqual(changes(), 1);
    });

    test("emits once per centerTexture", () => {
      const vp = makeViewport();
      const changes = countChanges(vp);

      vp.centerTexture();

      assert.strictEqual(changes(), 1);
    });

    test("does not emit from updateCanvasSize", () => {
      const vp = makeViewport();
      const changes = countChanges(vp);

      vp.updateCanvasSize(120, 120);

      assert.strictEqual(changes(), 0);
    });
  });
});
