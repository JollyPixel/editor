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
import type { UVGeometry } from "#src/uv/geometry/types.ts";
import { makeContainer } from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  canvasPixels,
  mockContextOf,
  readPixel
} from "./fixtures/canvas.ts";

describe("PixelArtCanvas", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("onBufferUpdated getter/setter", () => {
    test("is undefined by default and reflects the handler most recently assigned via the setter", () => {
      const { manager } = createPixelArtCanvas();
      const events: unknown[] = [];
      function handler(event: unknown): void {
        events.push(event);
      }

      assert.strictEqual(manager.onBufferUpdated, undefined);
      manager.onBufferUpdated = handler;
      assert.strictEqual(manager.onBufferUpdated, handler);
      manager.commitPixels([{ x: 0, y: 0 }]);
      assert.strictEqual(events.length, 1);

      manager.onBufferUpdated = undefined;
      assert.strictEqual(manager.onBufferUpdated, undefined);
      manager.destroy();
    });
  });

  describe("backgroundColor", () => {
    test("defaults to the parent element's computed CSS background-color", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.strictEqual(
        manager.backgroundColor,
        "rgba(18, 52, 86, 1)"
      );
      manager.destroy();
    });

    test("backgroundColor option overrides the CSS-inferred default", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        backgroundColor: "#ff0000"
      });

      assert.strictEqual(
        manager.backgroundColor,
        "rgba(255, 0, 0, 1)"
      );
      manager.destroy();
    });

    test("setting backgroundColor repaints the display outside the texture", () => {
      const { manager, canvas } = createPixelArtCanvas({
        backgroundTransparency: {
          colors: {
            odd: "rgba(0, 0, 0, 0)",
            even: "rgba(0, 0, 0, 0)"
          },
          squareSize: 8
        }
      });
      const outsideTexture = { x: 199, y: 199 };

      manager.backgroundColor = "#00ff00";

      assert.strictEqual(
        manager.backgroundColor,
        "rgba(0, 255, 0, 1)"
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(canvas), outsideTexture, canvas.width),
        [0, 255, 0, 255]
      );
      manager.destroy();
    });
  });

  describe("commitPixels", () => {
    const kBrushColors = {
      primary: { r: 0x12, g: 0x34, b: 0x56, a: 255 },
      secondary: { r: 0, g: 255, b: 0, a: 255 }
    };

    for (const source of ["primary", "secondary"] as const) {
      test(`commits pixels as a single 'stroke' hook event with the ${source} brush color`, () => {
        const events: PixelBufferHookEvent[] = [];
        const { manager } = createPixelArtCanvas({
          brush: {
            color: "#123456",
            secondaryColor: "#00FF00"
          },
          onBufferUpdated: (event) => events.push(event)
        });
        const positions = [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 1 }
        ];
        const { r, g, b, a } = kBrushColors[source];

        manager.commitPixels(positions, source);

        assert.deepStrictEqual(events, [
          {
            action: "stroke",
            metadata: {
              positions,
              color: kBrushColors[source]
            }
          }
        ]);
        assert.deepStrictEqual(
          readPixel(manager.texture, { x: 2, y: 1 }, 8),
          [r, g, b, a]
        );
        manager.destroy();
      });
    }

    test("empty pixel list is a no-op", () => {
      const events: unknown[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.commitPixels([]);

      assert.strictEqual(events.length, 0);
      manager.destroy();
    });
  });

  describe("textureCanvas", () => {
    test("holds the committed pixels", () => {
      const { manager } = createPixelArtCanvas({
        brush: { color: "#123456" }
      });

      manager.commitPixels([{ x: 2, y: 1 }]);

      assert.deepStrictEqual(
        readPixel(canvasPixels(manager.textureCanvas()), { x: 2, y: 1 }, 8),
        [0x12, 0x34, 0x56, 255]
      );
      manager.destroy();
    });
  });

  describe("hasTransparency", () => {
    const kFullTexture = { x: 0, y: 0, width: 8, height: 8 };
    const kCases: { name: string; geometry: UVGeometry; expected: boolean; }[] = [
      {
        name: "an opaque rect",
        geometry: { x: 1, y: 1, width: 7, height: 7 },
        expected: false
      },
      {
        name: "a rect over the transparent pixel",
        geometry: { x: 0, y: 0, width: 2, height: 2 },
        expected: true
      },
      {
        name: "a rect extending out of bounds",
        geometry: { x: 4, y: 4, width: 8, height: 8 },
        expected: true
      },
      {
        name: "a triangle whose sampled area excludes the transparent pixel",
        geometry: {
          shape: "triangle",
          corner: "bottom-right",
          rect: kFullTexture
        },
        expected: false
      },
      {
        name: "a triangle whose sampled area covers the transparent pixel",
        geometry: {
          shape: "triangle",
          corner: "top-left",
          rect: kFullTexture
        },
        expected: true
      }
    ];

    for (const { name, geometry, expected } of kCases) {
      test(`is ${expected} for ${name}`, () => {
        const { manager } = createPixelArtCanvas();
        manager.brush.primary.set("#000000", 0);
        manager.commitPixels([{ x: 0, y: 0 }]);

        assert.strictEqual(manager.hasTransparency(geometry), expected);
        manager.destroy();
      });
    }
  });

  describe("repaint (no double-paint)", () => {
    test("a committed stroke repaints exactly once", () => {
      const { manager, canvas } = createPixelArtCanvas();
      const displayCtx = mockContextOf(canvas);

      displayCtx.drawImageCallCount = 0;
      manager.centerTexture();
      const perFrame = displayCtx.drawImageCallCount;
      assert.ok(perFrame > 0, "centerTexture should repaint once");

      displayCtx.drawImageCallCount = 0;
      manager.commitPixels([{ x: 1, y: 1 }, { x: 2, y: 2 }]);

      assert.strictEqual(
        displayCtx.drawImageCallCount,
        perFrame,
        "one committed stroke should paint exactly one frame"
      );
      manager.destroy();
    });
  });

  describe("move mode navigation", () => {
    function drag(
      canvas: HTMLCanvasElement
    ): void {
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 130,
        clientY: 120,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }

    test("a plain left-drag pans the camera in move mode", () => {
      const { manager, canvas } = createPixelArtCanvas();
      manager.onResize();
      manager.centerTexture();
      manager.mode = "move";

      const before = manager.camera;
      drag(canvas);

      assert.notDeepStrictEqual(manager.camera, before);
      manager.destroy();
    });

    test("a left-drag does not pan in paint mode", () => {
      const { manager, canvas } = createPixelArtCanvas();
      manager.onResize();
      manager.centerTexture();

      const before = manager.camera;
      drag(canvas);

      assert.deepStrictEqual(manager.camera, before);
      manager.destroy();
    });
  });
});
