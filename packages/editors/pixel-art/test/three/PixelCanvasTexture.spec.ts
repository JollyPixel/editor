// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type {
  CanvasBufferEvent,
  SelectionRect,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelCanvasTexture } from "#src/three/PixelCanvasTexture.ts";
import type { PixelTextureSource } from "#src/three/types.ts";

// A stand-in for PixelArtCanvas: the three members PixelTextureSource needs.
class FakeSource extends Emitter<CanvasBufferEvent> implements PixelTextureSource {
  textureSize: Vec2 = { x: 64, y: 32 };
  #canvas = makeCanvas(64, 32);

  get document(): this {
    return this;
  }

  textureCanvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  swapCanvas(
    size: Vec2
  ): void {
    this.#canvas = makeCanvas(size.x, size.y);
    this.textureSize = size;
    this.emit("replaced", { size });
  }

  paint(
    bounds: SelectionRect
  ): void {
    this.emit("changed", { bounds });
  }
}

function makeCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

/** Collects scheduler callbacks so a test can decide when the frame runs. */
function manualScheduler() {
  const queue: (() => void)[] = [];

  return {
    schedule: (callback: () => void) => {
      queue.push(callback);
    },
    get pending() {
      return queue.length;
    },
    runAll() {
      const callbacks = queue.splice(0, queue.length);
      for (const callback of callbacks) {
        callback();
      }
    }
  };
}

describe("PixelCanvasTexture", () => {
  let source: FakeSource;

  beforeEach(() => {
    source = new FakeSource();
  });

  describe("constructor", () => {
    test("points a nearest-filtered sRGB texture at the source canvas", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });

      assert.strictEqual(bridge.texture.image, source.textureCanvas());
      assert.strictEqual(bridge.texture.magFilter, THREE.NearestFilter);
      assert.strictEqual(bridge.texture.minFilter, THREE.NearestFilter);
      assert.strictEqual(bridge.texture.generateMipmaps, false);
      assert.strictEqual(bridge.texture.colorSpace, THREE.SRGBColorSpace);
    });

    test("honors the linear filter and an explicit color space", () => {
      const bridge = new PixelCanvasTexture(source, {
        flush: "manual",
        filter: "linear",
        colorSpace: THREE.NoColorSpace
      });

      assert.strictEqual(bridge.texture.magFilter, THREE.LinearFilter);
      assert.strictEqual(bridge.texture.minFilter, THREE.LinearFilter);
      assert.strictEqual(bridge.texture.colorSpace, THREE.NoColorSpace);
    });
  });

  describe("consume", () => {
    test("returns null when nothing changed", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });
      const { version } = bridge.texture;

      assert.strictEqual(bridge.consume(), null);
      assert.strictEqual(
        bridge.texture.version,
        version,
        "an empty consume must not queue a GPU upload"
      );
    });

    test("returns the bounds of a single change and flags the texture", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });
      const { version } = bridge.texture;

      source.paint({ x: 2, y: 3, width: 4, height: 5 });

      assert.deepStrictEqual(
        bridge.consume(),
        { x: 2, y: 3, width: 4, height: 5 }
      );
      assert.strictEqual(bridge.texture.version, version + 1);
    });

    test("returns the union of every change since the last call", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });

      source.paint({ x: 10, y: 10, width: 2, height: 2 });
      source.paint({ x: 4, y: 20, width: 3, height: 1 });

      assert.deepStrictEqual(
        bridge.consume(),
        { x: 4, y: 10, width: 8, height: 11 }
      );
    });

    test("clears the accumulated bounds", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });

      source.paint({ x: 0, y: 0, width: 1, height: 1 });
      bridge.consume();

      assert.strictEqual(bridge.consume(), null);
    });
  });

  describe("flush modes", () => {
    test("\"manual\" never uploads on its own", () => {
      const scheduler = manualScheduler();
      const bridge = new PixelCanvasTexture(source, {
        flush: "manual",
        scheduler: scheduler.schedule
      });
      const { version } = bridge.texture;

      source.paint({ x: 0, y: 0, width: 1, height: 1 });

      assert.strictEqual(scheduler.pending, 0);
      assert.strictEqual(bridge.texture.version, version);
    });

    test("\"frame\" coalesces a burst of changes into one upload", () => {
      const scheduler = manualScheduler();
      const bridge = new PixelCanvasTexture(source, {
        flush: "frame",
        scheduler: scheduler.schedule
      });
      const { version } = bridge.texture;

      for (let index = 0; index < 20; index++) {
        source.paint({ x: index, y: 0, width: 1, height: 1 });
      }

      assert.strictEqual(scheduler.pending, 1);
      assert.strictEqual(bridge.texture.version, version);

      scheduler.runAll();

      assert.strictEqual(bridge.texture.version, version + 1);
      assert.strictEqual(bridge.consume(), null);
    });

    test("\"frame\" schedules again after a flush", () => {
      const scheduler = manualScheduler();
      new PixelCanvasTexture(source, {
        flush: "frame",
        scheduler: scheduler.schedule
      });

      source.paint({ x: 0, y: 0, width: 1, height: 1 });
      scheduler.runAll();
      source.paint({ x: 0, y: 0, width: 1, height: 1 });

      assert.strictEqual(scheduler.pending, 1);
    });

    test("\"immediate\" uploads once per change", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "immediate" });
      const { version } = bridge.texture;

      source.paint({ x: 0, y: 0, width: 1, height: 1 });
      source.paint({ x: 1, y: 0, width: 1, height: 1 });

      assert.strictEqual(bridge.texture.version, version + 2);
      assert.strictEqual(bridge.consume(), null);
    });
  });

  describe("surface changes", () => {
    test("resized re-emits the new size and dirties the whole texture", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });
      const sizes: Vec2[] = [];
      bridge.on("resized", ({ size }) => {
        sizes.push(size);
      });

      source.emit("resized", { size: { x: 16, y: 8 } });

      assert.deepStrictEqual(sizes, [{ x: 16, y: 8 }]);
      assert.deepStrictEqual(
        bridge.consume(),
        { x: 0, y: 0, width: 16, height: 8 }
      );
    });

    test("replaced re-points the texture at the new canvas element", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });
      const before = bridge.texture.image;
      const sizes: Vec2[] = [];
      bridge.on("resized", ({ size }) => {
        sizes.push(size);
      });

      source.swapCanvas({ x: 32, y: 32 });

      assert.notStrictEqual(bridge.texture.image, before);
      assert.strictEqual(bridge.texture.image, source.textureCanvas());
      assert.deepStrictEqual(sizes, [{ x: 32, y: 32 }]);
      assert.deepStrictEqual(
        bridge.consume(),
        { x: 0, y: 0, width: 32, height: 32 }
      );
    });
  });

  describe("dispose", () => {
    test("stops tracking the source", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });
      bridge.dispose();

      source.paint({ x: 0, y: 0, width: 4, height: 4 });

      assert.strictEqual(bridge.consume(), null);
    });

    test("drops a frame already scheduled", () => {
      const scheduler = manualScheduler();
      const bridge = new PixelCanvasTexture(source, {
        flush: "frame",
        scheduler: scheduler.schedule
      });

      source.paint({ x: 0, y: 0, width: 1, height: 1 });
      const { version } = bridge.texture;
      bridge.dispose();
      scheduler.runAll();

      assert.strictEqual(bridge.texture.version, version);
    });

    test("is idempotent", () => {
      const bridge = new PixelCanvasTexture(source, { flush: "manual" });

      bridge.dispose();
      bridge.dispose();
    });
  });
});
