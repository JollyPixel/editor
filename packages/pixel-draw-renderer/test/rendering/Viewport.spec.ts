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
    test("throws when zoomMax < zoomMin", () => {
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

    test("clamps initial zoom to [min, max]", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 100,
        zoomMin: 1,
        zoomMax: 32
      });

      assert.strictEqual(vp.zoom.value, 32);
    });

    test("defaults zoom to 4", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        }
      });

      assert.strictEqual(vp.zoom.value, 4);
    });
  });

  describe("clampCamera", () => {
    test("prevents camera from going past negative bound", () => {
      const vp = new Viewport({
        textureSize: {
          x: 8,
          y: 8
        },
        zoom: 4
      });
      vp.updateCanvasSize(100, 100);
      // Texture is 32x32 px; margin = 4; minX = -32+4 = -28
      vp.applyPan(-10000, 0);

      assert.ok(
        vp.camera.x >= -28,
        `camera.x ${vp.camera.x} should be >= -28`
      );
    });

    test("prevents camera from going past positive bound", () => {
      const vp = new Viewport({
        textureSize: {
          x: 8,
          y: 8
        },
        zoom: 4
      });
      vp.updateCanvasSize(100, 100);
      // maxX = 100-4 = 96
      vp.applyPan(10000, 0);

      assert.ok(
        vp.camera.x <= 96,
        `camera.x ${vp.camera.x} should be <= 96`
      );
    });
  });

  describe("applyZoom", () => {
    test("zooms in (negative delta increases zoom)", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4,
        zoomSmoothing: 0
      });
      vp.updateCanvasSize(200, 200);
      const before = vp.zoom.value;
      vp.applyZoom(-100, 100, 100);

      assert.ok(
        vp.zoom.value > before,
        `zoom ${vp.zoom.value} should be greater than ${before}`
      );
    });

    test("zooms out (positive delta decreases zoom)", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 4,
        zoomSmoothing: 0
      });
      vp.updateCanvasSize(200, 200);
      const before = vp.zoom.value;
      vp.applyZoom(100, 100, 100);

      assert.ok(
        vp.zoom.value < before,
        `zoom ${vp.zoom.value} should be less than ${before}`
      );
    });

    test("clamps zoom to zoomMin", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 1,
        zoomMin: 1
      });
      vp.updateCanvasSize(200, 200);
      vp.applyZoom(100, 100, 100);
      assert.strictEqual(vp.zoom.value, 1);
    });

    test("clamps zoom to zoomMax", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        },
        zoom: 32,
        zoomMax: 32
      });
      vp.updateCanvasSize(200, 200);
      vp.applyZoom(-100, 100, 100);

      assert.strictEqual(vp.zoom.value, 32);
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

  describe("zoom.sensitivity setter", () => {
    test("updates sensitivity", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        }
      });
      vp.zoom.sensitivity = 0.5;

      assert.strictEqual(vp.zoom.sensitivity, 0.5);
    });

    test("clamps to a minimum of 0.01", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        }
      });
      vp.zoom.sensitivity = -5;

      assert.strictEqual(vp.zoom.sensitivity, 0.01);
    });

    test("defaults to 0.25", () => {
      const vp = new Viewport({
        textureSize: {
          x: 16,
          y: 16
        }
      });

      assert.strictEqual(vp.zoom.sensitivity, 0.25);
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
