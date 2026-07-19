// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

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
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button: 0, buttons: 1, clientX, clientY, bubbles: true
  }));
  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function readPixel(
  pixels: Uint8ClampedArray,
  pos: { x: number; y: number; },
  width: number
): [number, number, number, number] {
  const i = (pos.y * width + pos.x) * 4;

  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

describe("PixelArtCanvas — fill mode", () => {
  let container: HTMLDivElement;
  let children: MockCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
  });

  describe("fillGlobal", () => {
    test("defaults to false (contiguous) and is not configurable at construction", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });

      assert.strictEqual(manager.fillGlobal, false);
      manager.destroy();
    });

    test("setting fillGlobal toggles the runtime state, persisting across mode switches", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });

      manager.fillGlobal = true;
      assert.strictEqual(manager.fillGlobal, true);

      manager.mode = "paint";
      manager.mode = "fill";
      assert.strictEqual(manager.fillGlobal, true, "toggle persists across mode switches");

      manager.fillGlobal = false;
      assert.strictEqual(manager.fillGlobal, false);
      manager.destroy();
    });
  });

  describe("global fill behavior", () => {
    // 8x8 texture, zoom 1 -> centered camera (96, 96). client(96+x, 96+y) -> texture (x, y).
    test("recolors every disconnected same-colored pixel on the canvas, not just the seed's connected region", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        zoom: { default: 1 },
        brush: { size: 1, maxSize: 1, color: "#000000" }
      });
      const canvas = children[0];

      // Two disconnected single-pixel black dots, far apart, on the default white background.
      // texture (2, 2)
      paintOnePixel(canvas, 98, 98);
      // texture (6, 6)
      paintOnePixel(canvas, 102, 102);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), [0, 0, 0, 255]);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 6, y: 6 }, 8), [0, 0, 0, 255]);

      manager.mode = "fill";
      manager.fillGlobal = true;
      manager.brush.primary.set("#FF0000");
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 98, clientY: 98, bubbles: true
      }));

      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), [255, 0, 0, 255]);
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
    });

    test("right-click recolors with the secondary color instead of primary", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        zoom: { default: 1 },
        brush: { size: 1, maxSize: 1, color: "#000000", secondaryColor: "#00FF00" }
      });
      const canvas = children[0];

      // texture (2, 2)
      paintOnePixel(canvas, 98, 98);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), [0, 0, 0, 255]);

      manager.mode = "fill";
      manager.fillGlobal = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2, buttons: 2, clientX: 98, clientY: 98, bubbles: true
      }));

      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8), [0, 255, 0, 255]);
      manager.destroy();
    });

    test("is a no-op when the seed already matches the brush color", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        zoom: { default: 1 },
        defaultMode: "fill",
        brush: { color: "#FFFFFF" },
        onBufferUpdated: (event) => events.push(event)
      });
      manager.fillGlobal = true;
      const canvas = children[0];

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 98, clientY: 98, bubbles: true
      }));

      assert.strictEqual(events.length, 0, "fill color already matches the target region's color");
      manager.destroy();
    });
  });

  describe("brush highlight", () => {
    test("paint mode uses the real brush size; fill mode forces the highlight to a single pixel", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        zoom: { default: 4 },
        brush: { size: 5, maxSize: 32 }
      });
      const canvas = children[0];
      const svg = children[1] as unknown as SVGElement;
      const group = svg.querySelector("g");
      assert.ok(group, "highlight group should exist");

      canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 100, bubbles: true }));
      assert.ok(
        group!.getAttribute("transform")?.includes("scale(20)"),
        "paint mode: brush size 5 * zoom 4"
      );

      manager.mode = "fill";
      canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 101, clientY: 101, bubbles: true }));
      assert.ok(
        group!.getAttribute("transform")?.includes("scale(4)"),
        "fill mode: size forced to 1, ignoring brush.size=5 -> 1 * zoom 4"
      );

      manager.mode = "paint";
      manager.pickColorArmed = true;
      canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 102, clientY: 102, bubbles: true }));
      assert.ok(
        group!.getAttribute("transform")?.includes("scale(4)"),
        "armed pick: size forced to 1, ignoring brush.size=5 -> 1 * zoom 4"
      );

      manager.destroy();
    });
  });

  describe("color pick", () => {
    // 8x8 texture, zoom 4 -> centered camera (84, 84); client(100,100) -> texture (4,4).
    function makeManager(): { manager: PixelArtCanvas; canvas: MockCanvasElement; } {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 }, defaultColor: "#123456" },
        zoom: { default: 4 },
        defaultMode: "paint",
        brush: { color: "#000000" }
      });

      return { manager, canvas: children[0] };
    }

    test("an armed paint-mode click samples the color, updates the brush, and auto-disarms", () => {
      const { manager, canvas } = makeManager();

      let detail: any = null;
      canvas.addEventListener("colorpicked", (event: Event) => {
        detail = (event as CustomEvent<{ hex: string; opacity: number; }>).detail;
      });

      manager.pickColorArmed = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.ok(detail, "colorpicked event should fire");
      assert.strictEqual(detail.hex, "#123456");
      assert.strictEqual(manager.brush.primary.asString("hex"), "#123456");
      assert.strictEqual(manager.pickColorArmed, false);
      manager.destroy();
    });

    test("an armed click outside the texture bounds does not pick and stays armed", () => {
      const { manager, canvas } = makeManager();

      let fired = false;
      canvas.addEventListener("colorpicked", () => {
        fired = true;
      });

      manager.pickColorArmed = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 1000, clientY: 1000, bubbles: true
      }));

      assert.strictEqual(fired, false);
      assert.strictEqual(manager.pickColorArmed, true);
      assert.strictEqual(manager.brush.primary.asString("hex"), "#000000");
      manager.destroy();
    });

    test("right-click no longer picks a color", () => {
      const { manager, canvas } = makeManager();

      let fired = false;
      canvas.addEventListener("colorpicked", () => {
        fired = true;
      });

      canvas.dispatchEvent(new MouseEvent("contextmenu", {
        clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(fired, false);
      manager.destroy();
    });

    test("switching away from paint mode auto-disarms the picker", () => {
      const { manager } = makeManager();

      manager.pickColorArmed = true;
      manager.mode = "fill";

      assert.strictEqual(manager.pickColorArmed, false);
      manager.destroy();
    });

    test("pickColorAt samples directly regardless of mode, ignoring the armed flag", () => {
      const { manager } = makeManager();
      manager.mode = "select";

      const color = manager.pickColorAt(4, 4);

      assert.deepStrictEqual(color, { r: 0x12, g: 0x34, b: 0x56, a: 255 });
      assert.strictEqual(manager.brush.primary.asString("hex"), "#123456");
      manager.destroy();
    });

    test("pickColorAt returns null and leaves the brush untouched outside the texture", () => {
      const { manager } = makeManager();

      const color = manager.pickColorAt(-1, -1);

      assert.strictEqual(color, null);
      assert.strictEqual(manager.brush.primary.asString("hex"), "#000000");
      manager.destroy();
    });
  });
});
