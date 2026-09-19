// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  moveTo,
  wheel
} from "./helpers/events.ts";

describe("PixelArtCanvas — wheel zoom", () => {
  function mockFrames(
    t: TestContext
  ): { frames: Array<() => void>; step: (elapsedMs: number) => void; } {
    let now = 0;
    const frames: Array<() => void> = [];
    t.mock.method(performance, "now", () => now);
    t.mock.method(globalThis, "requestAnimationFrame", (callback: () => void) => {
      frames.push(callback);

      return frames.length;
    });
    t.mock.method(globalThis, "cancelAnimationFrame", () => {
      frames.length = 0;
    });

    return {
      frames,
      step: (elapsedMs) => {
        now += elapsedMs;
        frames.shift()?.();
      }
    };
  }

  test("eases the zoom over animation frames", (t) => {
    const { frames, step } = mockFrames(t);
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    manager.mode = "fill";

    canvas.dispatchEvent(wheel({ deltaY: -100, clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(wheel({ deltaY: -100, clientX: 50, clientY: 50 }));
    assert.strictEqual(manager.zoom.value, 4);
    assert.strictEqual(frames.length, 1);

    step(16);
    assert.ok(manager.zoom.value > 4);
    assert.ok(manager.zoom.value < manager.zoom.target);

    step(1000);
    assert.strictEqual(manager.zoom.value, manager.zoom.target);
    assert.strictEqual(frames.length, 0);
    manager.destroy();
  });

  test("destroy cancels a running zoom animation", (t) => {
    const { frames } = mockFrames(t);
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    manager.mode = "fill";

    canvas.dispatchEvent(wheel({ deltaY: -100 }));
    manager.destroy();

    assert.strictEqual(frames.length, 0);
  });
});

describe("PixelArtCanvas — Ctrl+wheel brush size", () => {
  test("adjusts the brush one pixel per scroll direction in paint mode", () => {
    const { manager, canvas } = createPixelArtCanvas({
      brush: { size: 4, maxSize: 8 }
    });

    canvas.dispatchEvent(wheel({ deltaY: -100, ctrlKey: true }));
    assert.strictEqual(manager.brush.size, 5);

    canvas.dispatchEvent(wheel({ deltaY: 100, ctrlKey: true }));
    assert.strictEqual(manager.brush.size, 4);
    manager.destroy();
  });

  test("keeps Ctrl+wheel zoom in non-paint modes", () => {
    const { manager, canvas } = createPixelArtCanvas({
      brush: { size: 4, maxSize: 8 },
      zoom: { default: 4 }
    });
    manager.mode = "fill";
    const zoomBefore = manager.zoom.value;

    canvas.dispatchEvent(wheel({ deltaY: 100, ctrlKey: true }));

    assert.strictEqual(manager.brush.size, 4);
    assert.ok(manager.zoom.target < zoomBefore);
    manager.destroy();
  });

  test("refreshes the visible brush overlay after resizing", () => {
    const { manager, canvas, children } = createPixelArtCanvas({
      brush: { size: 4, maxSize: 8 }
    });
    moveTo(canvas, 100, 100);

    canvas.dispatchEvent(wheel({ deltaY: -100, ctrlKey: true }));

    const overlay = children[1] as unknown as SVGElement;
    const highlight = overlay.querySelector('g[data-overlay="brush-highlight"]');
    assert.ok(
      highlight?.getAttribute("transform")?.includes(`scale(${manager.zoom.value * 5})`)
    );
    manager.destroy();
  });
});
