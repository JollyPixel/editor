// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import { CanvasManager } from "../src/CanvasManager.ts";
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

describe("CanvasManager — onBufferUpdated", () => {
  let container: HTMLDivElement;
  let children: MockCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
  });

  describe("stroke", () => {
    test("emits a single 'stroke' event on mouseup, deduped across moves", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
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
      const manager = new CanvasManager(container, {
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
      const manager = new CanvasManager(container, {
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
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.setTextureSize({ x: 16, y: 4 });

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "resized");
      if (events[0].action === "resized") {
        assert.deepStrictEqual(events[0].metadata.size, { x: 16, y: 4 });
      }
      manager.destroy();
    });

    test("invalid size does not emit an event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.setTextureSize({ x: 0, y: 4 });

      assert.strictEqual(events.length, 0);
      manager.destroy();
    });
  });

  describe("texture-replaced", () => {
    test("setTexture emits a 'texture-replaced' event with decodable base64 pixels", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 4, y: 4 } },
        onBufferUpdated: (event) => events.push(event)
      });

      const externalCanvas = kEmulatedBrowserWindow.document.createElement("canvas") as unknown as HTMLCanvasElement;
      externalCanvas.width = 4;
      externalCanvas.height = 4;
      manager.setTexture(externalCanvas);

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

describe("CanvasManager — applyRemoteCommand", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  test("stroke: applies pixels without re-emitting onBufferUpdated (echo guard)", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new CanvasManager(container, {
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

  test("resized: delegates to setTextureSize without re-emitting onBufferUpdated", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new CanvasManager(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onBufferUpdated: (event) => events.push(event)
    });

    manager.applyRemoteCommand({
      action: "resized",
      metadata: { size: { x: 2, y: 2 } }
    });

    assert.strictEqual(events.length, 0);
    assert.deepStrictEqual(manager.getTextureSize(), { x: 2, y: 2 });
    manager.destroy();
  });

  test("texture-replaced: decodes base64 pixels and updates size without re-emitting", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new CanvasManager(container, {
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
    assert.deepStrictEqual(manager.getTextureSize(), { x: 2, y: 2 });
    manager.destroy();
  });
});

describe("CanvasManager — loadSnapshot", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  test("hydrates pixel data without emitting onBufferUpdated", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new CanvasManager(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      onBufferUpdated: (event) => events.push(event)
    });

    const pixels = new Uint8ClampedArray(3 * 3 * 4).fill(1);
    manager.loadSnapshot({ x: 3, y: 3 }, pixels);

    assert.strictEqual(events.length, 0);
    assert.deepStrictEqual(manager.getTextureSize(), { x: 3, y: 3 });
    manager.destroy();
  });
});
