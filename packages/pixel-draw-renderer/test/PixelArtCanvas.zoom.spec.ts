// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import { makeContainer } from "./helpers/dom.ts";

describe("PixelArtCanvas — zoom", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  test("zoom.sensitivity returns the configured default", () => {
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      zoom: {
        default: 4,
        sensitivity: 0.25
      }
    });

    assert.strictEqual(manager.zoom.sensitivity, 0.25);
    manager.destroy();
  });

  describe("default zoom fits the texture to the container", () => {
    test("computes floor(min(200/8, 200/8) * 0.9) = 22 when zoom.default is omitted", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.strictEqual(manager.zoom.value, 22);
      manager.destroy();
    });

    test("an explicit zoom.default always wins over the fit computation", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        zoom: { default: 4 }
      });

      assert.strictEqual(manager.zoom.value, 4);
      manager.destroy();
    });

    test("clamps the computed fit zoom to zoomMax for a tiny texture in a large container", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 2, y: 2 }
        },
        zoom: { max: 5 }
      });

      assert.strictEqual(manager.zoom.value, 5);
      manager.destroy();
    });

    test("clamps the computed fit zoom to zoomMin for a texture much larger than the container", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 2048,
          size: { x: 1000, y: 1000 }
        }
      });

      assert.strictEqual(manager.zoom.value, 1);
      manager.destroy();
    });

    test("falls back to Zoom's own default (4) when the container has no measurable size", () => {
      const zeroSizeContainer = makeContainer(0, 0);
      const manager = new PixelArtCanvas(zeroSizeContainer, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.strictEqual(manager.zoom.value, 4);
      manager.destroy();
    });

    test("scales with a smaller container: floor(min(100/8, 100/8) * 0.9) = 11", () => {
      const smallContainer = makeContainer(100, 100);
      const manager = new PixelArtCanvas(smallContainer, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.strictEqual(manager.zoom.value, 11);
      manager.destroy();
    });
  });
});
