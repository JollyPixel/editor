// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { makeContainer } from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { stroke } from "./helpers/events.ts";
import { readPixel } from "./fixtures/canvas.ts";

describe("PixelArtCanvas — fill mode", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("tools.fill.global", () => {
    test("defaults to false (contiguous) and is not configurable at construction", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.ok(!manager.tools.fill.global);
      manager.destroy();
    });

    test("setting tools.fill.global toggles the runtime state, persisting across mode switches", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      manager.tools.fill.global = true;
      assert.ok(manager.tools.fill.global);

      manager.mode = "paint";
      manager.mode = "fill";
      assert.ok(manager.tools.fill.global, "toggle persists across mode switches");

      manager.tools.fill.global = false;
      assert.ok(!manager.tools.fill.global);
      manager.destroy();
    });
  });

  describe("fill mode", () => {
    test("click flood-fills the connected region as a single stroke", () => {
      const events: unknown[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        texture: {
          size: { x: 16, y: 16 }
        },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        onBufferUpdated: (event) => events.push(event)
      });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(events.length, 1);
      const event = events[0] as {
        action: string;
        metadata: { positions: unknown[]; };
      };
      assert.strictEqual(event.action, "stroke");
      assert.strictEqual(event.metadata.positions.length, 16 * 16);
      manager.destroy();
    });

    test("click does not arm a freehand drag stroke afterwards", () => {
      const events: unknown[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        texture: { size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        onBufferUpdated: (event) => events.push(event)
      });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 110,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 1, "only the single fill click commits — no chained freehand stroke");
      manager.destroy();
    });
  });

  describe("global fill behavior", () => {
    test(
      "recolors every disconnected same-colored pixel on the canvas, not just the seed's connected region",
      () => {
        const manager = new PixelArtCanvas(container, {
          texture: {
            maxSize: 32,
            size: { x: 8, y: 8 }
          },
          zoom: { default: 1 },
          brush: {
            size: 1,
            maxSize: 1,
            color: "#000000"
          }
        });
        const canvas = manager.canvas();

        stroke(canvas, [[98, 98]]);
        stroke(canvas, [[102, 102]]);
        assert.deepStrictEqual(
          readPixel(manager.texture, { x: 2, y: 2 }, 8),
          [0, 0, 0, 255]
        );
        assert.deepStrictEqual(
          readPixel(manager.texture, { x: 6, y: 6 }, 8),
          [0, 0, 0, 255]
        );

        manager.mode = "fill";
        manager.tools.fill.global = true;
        manager.brush.primary.set("#FF0000");
        canvas.dispatchEvent(new MouseEvent("mousedown", {
          button: 0,
          buttons: 1,
          clientX: 98,
          clientY: 98,
          bubbles: true
        }));

        assert.deepStrictEqual(
          readPixel(manager.texture, { x: 2, y: 2 }, 8),
          [255, 0, 0, 255]
        );
        assert.deepStrictEqual(
          readPixel(manager.texture, { x: 6, y: 6 }, 8),
          [255, 0, 0, 255],
          "the disconnected dot elsewhere on the canvas is recolored too"
        );
        assert.deepStrictEqual(
          readPixel(manager.texture, { x: 3, y: 3 }, 8),
          [255, 255, 255, 255],
          "untouched background stays white"
        );
        manager.destroy();
      }
    );

    test("right-click recolors with the secondary color instead of primary", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        zoom: { default: 1 },
        brush: {
          size: 1,
          maxSize: 1,
          color: "#000000",
          secondaryColor: "#00FF00"
        }
      });
      const canvas = manager.canvas();

      stroke(canvas, [[98, 98]]);
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255]
      );

      manager.mode = "fill";
      manager.tools.fill.global = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2,
        buttons: 2,
        clientX: 98,
        clientY: 98,
        bubbles: true
      }));

      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 255, 0, 255]
      );
      manager.destroy();
    });

    test("is a no-op when the seed already matches the brush color", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        zoom: { default: 1 },
        defaultMode: "fill",
        brush: { color: "#FFFFFF" },
        onBufferUpdated: (event) => events.push(event)
      });
      manager.tools.fill.global = true;

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 98,
        clientY: 98,
        bubbles: true
      }));

      assert.strictEqual(events.length, 0, "fill color already matches the target region's color");
      manager.destroy();
    });
  });
});
