// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import { PixelArtCanvas } from "../src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "../src/buffer/hooks.ts";
import { installCanvasMock, MockCanvasElement } from "./mocks.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  // @ts-expect-error
  globalThis.window = kEmulatedBrowserWindow as unknown as Window & typeof globalThis;
  // @ts-expect-error
  globalThis.getComputedStyle = (_el: unknown) => {
    return { backgroundColor: "#555555" };
  };
  globalThis.MouseEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).MouseEvent as typeof MouseEvent;
  installCanvasMock(globalThis.document);
});

function makeContainer(): { container: HTMLDivElement; children: MockCanvasElement[]; } {
  const div = kEmulatedBrowserWindow.document.createElement("div") as unknown as HTMLDivElement;
  const children: MockCanvasElement[] = [];
  (div as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };
  (div as any).style = {};
  (div as any).appendChild = (child: unknown) => {
    children.push(child as MockCanvasElement);
  };

  return { container: div, children };
}

function paintOnePixel(
  canvas: MockCanvasElement,
  positions: [number, number][]
): void {
  const [firstX, firstY] = positions[0];
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button: 0, buttons: 1, clientX: firstX, clientY: firstY, bubbles: true
  }));

  for (const [x, y] of positions.slice(1)) {
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1, clientX: x, clientY: y, bubbles: true
    }));
  }

  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

describe("PixelArtCanvas — onBufferUpdated", () => {
  let container: HTMLDivElement;
  let children: MockCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
  });

  describe("stroke", () => {
    test("emits a single 'stroke' event on mouseup, deduped across moves", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        zoom: { default: 4 },
        brush: { size: 1, maxSize: 1 },
        onBufferUpdated: (event) => events.push(event)
      });
      const canvas = children[0];

      // (88,88) -> texture (1,1); (92,88) -> texture (2,1); repeat (88,88) to test dedup
      paintOnePixel(canvas, [[88, 88], [92, 88], [88, 88]]);

      assert.strictEqual(events.length, 1);
      const event = events[0];
      assert.strictEqual(event.action, "stroke");
      if (event.action !== "stroke") {
        return;
      }
      assert.deepStrictEqual(event.metadata.color, { r: 0, g: 0, b: 0, a: 255 });
      assert.deepStrictEqual(event.metadata.positions, [{ x: 1, y: 1 }, { x: 2, y: 1 }]);

      manager.destroy();
    });

    test("does not throw when no onBufferUpdated listener is attached", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 }
      });
      const canvas = children[0];

      assert.doesNotThrow(() => paintOnePixel(canvas, [[88, 88]]));
      manager.destroy();
    });

    test("still calls onDrawEnd alongside the stroke hook", () => {
      const events: PixelBufferHookEvent[] = [];
      let drawEndCalls = 0;
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        onBufferUpdated: (event) => events.push(event),
        onDrawEnd: () => {
          drawEndCalls++;
        }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);

      assert.strictEqual(drawEndCalls, 1);
      assert.strictEqual(events.length, 1);
      manager.destroy();
    });
  });

  describe("resized", () => {
    test("setTextureSize emits a 'resized' event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.textureSize = { x: 16, y: 4 };

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "resized");
      if (events[0].action === "resized") {
        assert.deepStrictEqual(events[0].metadata.size, { x: 16, y: 4 });
      }
      manager.destroy();
    });

    test("invalid size does not emit an event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.textureSize = { x: 0, y: 4 };

      assert.strictEqual(events.length, 0);
      manager.destroy();
    });
  });

  describe("global-fill", () => {
    test("emits a compact 'global-fill' event (fromColor/toColor, no positions)", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        onBufferUpdated: (event) => events.push(event)
      });
      manager.fillGlobal = true;
      const canvas = children[0];

      // 16x16 texture, zoom 4 -> centered camera (68,68); client(100,100) -> texture (8,8).
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 1);
      const event = events[0];
      assert.strictEqual(event.action, "global-fill");
      if (event.action !== "global-fill") {
        return;
      }
      assert.deepStrictEqual(event.metadata.fromColor, { r: 255, g: 255, b: 255, a: 255 });
      assert.deepStrictEqual(event.metadata.toColor, { r: 255, g: 0, b: 0, a: 255 });
      manager.destroy();
    });
  });

  describe("texture-replaced", () => {
    test("setTexture emits a 'texture-replaced' event with decodable base64 pixels", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 4, y: 4 } },
        onBufferUpdated: (event) => events.push(event)
      });

      const externalCanvas = kEmulatedBrowserWindow.document.createElement("canvas") as unknown as HTMLCanvasElement;
      externalCanvas.width = 4;
      externalCanvas.height = 4;
      manager.texture = externalCanvas;

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "texture-replaced");
      if (events[0].action !== "texture-replaced") {
        return;
      }
      assert.deepStrictEqual(events[0].metadata.size, { x: 4, y: 4 });
      assert.strictEqual(toUint8Array(events[0].metadata.pixels).length, 4 * 4 * 4);
      manager.destroy();
    });
  });
});

describe("PixelArtCanvas — applyRemoteCommand", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  test("stroke: applies pixels without re-emitting onBufferUpdated (echo guard)", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onBufferUpdated: (event) => events.push(event)
    });

    manager.applyRemoteCommand({
      action: "stroke",
      metadata: { color: { r: 9, g: 8, b: 7, a: 255 }, positions: [{ x: 0, y: 0 }] }
    });

    assert.strictEqual(events.length, 0);
    manager.destroy();
  });

  test("stroke: still calls onDrawEnd so external consumers can sync", () => {
    let drawEndCalls = 0;
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onDrawEnd: () => {
        drawEndCalls++;
      }
    });

    manager.applyRemoteCommand({
      action: "stroke",
      metadata: { color: { r: 9, g: 8, b: 7, a: 255 }, positions: [{ x: 0, y: 0 }] }
    });

    assert.strictEqual(drawEndCalls, 1);
    manager.destroy();
  });

  test("resized: delegates to setTextureSize without re-emitting onBufferUpdated", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onBufferUpdated: (event) => events.push(event)
    });

    manager.applyRemoteCommand({
      action: "resized",
      metadata: { size: { x: 2, y: 2 } }
    });

    assert.strictEqual(events.length, 0);
    assert.deepStrictEqual(manager.textureSize, { x: 2, y: 2 });
    manager.destroy();
  });

  test("global-fill: recomputes matching pixels from fromColor and repaints them toColor", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 4, y: 4 } },
      onBufferUpdated: (event) => events.push(event)
    });

    manager.applyRemoteCommand({
      action: "global-fill",
      metadata: {
        fromColor: { r: 255, g: 255, b: 255, a: 255 },
        toColor: { r: 9, g: 8, b: 7, a: 255 }
      }
    });

    assert.strictEqual(events.length, 0);
    // Whole 4x4 texture is uniformly white by default except (0,0), which
    // PixelBuffer always initializes fully transparent.
    const [r, g, b, a] = manager.texture.subarray(4, 8);
    assert.deepStrictEqual([r, g, b, a], [9, 8, 7, 255]);
    manager.destroy();
  });

  test("global-fill: still calls onDrawEnd so external consumers can sync", () => {
    let drawEndCalls = 0;
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 4, y: 4 } },
      onDrawEnd: () => {
        drawEndCalls++;
      }
    });

    manager.applyRemoteCommand({
      action: "global-fill",
      metadata: {
        fromColor: { r: 255, g: 255, b: 255, a: 255 },
        toColor: { r: 9, g: 8, b: 7, a: 255 }
      }
    });

    assert.strictEqual(drawEndCalls, 1);
    manager.destroy();
  });

  test("texture-replaced: decodes base64 pixels and updates size without re-emitting", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onBufferUpdated: (event) => events.push(event)
    });

    const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(200);
    const base64 = Buffer.from(pixels).toString("base64");

    manager.applyRemoteCommand({
      action: "texture-replaced",
      metadata: { size: { x: 2, y: 2 }, pixels: base64 }
    });

    assert.strictEqual(events.length, 0);
    assert.deepStrictEqual(manager.textureSize, { x: 2, y: 2 });
    manager.destroy();
  });
});

describe("PixelArtCanvas — loadSnapshot", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  test("hydrates pixel data without emitting onBufferUpdated", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onBufferUpdated: (event) => events.push(event)
    });

    const pixels = new Uint8ClampedArray(3 * 3 * 4).fill(1);
    manager.loadSnapshot({ x: 3, y: 3 }, pixels);

    assert.strictEqual(events.length, 0);
    assert.deepStrictEqual(manager.textureSize, { x: 3, y: 3 });
    manager.destroy();
  });
});
