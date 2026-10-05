// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import {
  makeContainer,
  overlayOf
} from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  mouseEvent,
  moveTo
} from "./helpers/events.ts";
import { readPixel } from "./fixtures/canvas.ts";

describe("PixelArtCanvas — paint mode", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("brush highlight", () => {
    test("paint mode uses the real brush size; fill mode forces the highlight to a single pixel", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        zoom: { default: 4 },
        brush: { size: 5, maxSize: 32 }
      });
      const canvas = manager.canvas();
      const svg = overlayOf(container);
      const group = svg.querySelector('g[data-overlay="brush-highlight"]');
      assert.ok(group, "highlight group should exist");

      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 100,
          clientY: 100,
          bubbles: true
        })
      );
      assert.ok(
        group!.getAttribute("transform")?.includes("scale(20)"),
        "paint mode: brush size 5 * zoom 4"
      );

      manager.mode = "fill";
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 101,
          clientY: 101,
          bubbles: true
        })
      );
      assert.ok(
        group!.getAttribute("transform")?.includes("scale(4)"),
        "fill mode: size forced to 1, ignoring brush.size=5 -> 1 * zoom 4"
      );

      manager.mode = "paint";
      manager.tools.brush.pickArmed = true;
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 102,
          clientY: 102,
          bubbles: true
        })
      );
      assert.ok(
        group!.getAttribute("transform")?.includes("scale(4)"),
        "armed pick: size forced to 1, ignoring brush.size=5 -> 1 * zoom 4"
      );

      manager.destroy();
    });

    test("stays hidden while panHeld is set, through a pan, and returns on release", () => {
      const { manager, canvas, overlay } = createPixelArtCanvas({
        zoom: { default: 4 }
      });
      const group = overlay.querySelector('g[data-overlay="brush-highlight"]');
      moveTo(canvas, 100, 100);

      manager.shortcuts.panHeld = true;
      assert.strictEqual(group?.getAttribute("visibility"), "hidden");

      canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));
      window.dispatchEvent(mouseEvent("mousemove", 120, 110));
      moveTo(canvas, 120, 110);
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      assert.strictEqual(group?.getAttribute("visibility"), "hidden");

      manager.shortcuts.panHeld = false;
      assert.strictEqual(group?.getAttribute("visibility"), "visible");
      manager.destroy();
    });
  });

  describe("color pick", () => {
    function makeManager(): { manager: PixelArtCanvas; canvas: HTMLCanvasElement; } {
      return createPixelArtCanvas({
        texture: { defaultColor: "#123456" },
        zoom: { default: 4 },
        defaultMode: "paint",
        brush: { color: "#000000" }
      });
    }

    test("an armed paint-mode click samples the color, updates the brush, and auto-disarms", () => {
      const { manager, canvas } = makeManager();

      let detail: any = null;
      canvas.addEventListener("colorpicked", (event: Event) => {
        detail = (event as CustomEvent<{ hex: string; opacity: number; }>).detail;
      });

      manager.tools.brush.pickArmed = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.ok(detail, "colorpicked event should fire");
      assert.strictEqual(detail.hex, "#123456");
      assert.strictEqual(
        manager.brush.primary.asString("hex"),
        "#123456"
      );
      assert.ok(!manager.tools.brush.pickArmed);
      manager.destroy();
    });

    test("an armed right-click samples into the secondary color without drawing", () => {
      const { manager, canvas } = makeManager();

      let detail: any = null;
      canvas.addEventListener("colorpicked", (event: Event) => {
        detail = (event as CustomEvent<{
          hex: string;
          opacity: number;
          slot: "primary" | "secondary";
        }>).detail;
      });

      manager.tools.brush.pickArmed = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2,
        buttons: 2,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.deepStrictEqual(detail, {
        hex: "#123456",
        opacity: 1,
        slot: "secondary"
      });
      assert.strictEqual(
        manager.brush.primary.asString("hex"),
        "#000000"
      );
      assert.strictEqual(
        manager.brush.secondary.asString("hex"),
        "#123456"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 4 }, 8),
        [0x12, 0x34, 0x56, 255]
      );
      assert.ok(!manager.tools.brush.pickArmed);
      manager.destroy();
    });

    test("an armed click outside the texture bounds does not pick and stays armed", () => {
      const { manager, canvas } = makeManager();

      let fired = false;
      canvas.addEventListener("colorpicked", () => {
        fired = true;
      });

      manager.tools.brush.pickArmed = true;
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 1000,
        clientY: 1000,
        bubbles: true
      }));

      assert.ok(!fired);
      assert.ok(manager.tools.brush.pickArmed);
      assert.strictEqual(
        manager.brush.primary.asString("hex"),
        "#000000"
      );
      manager.destroy();
    });

    test("switching away from paint mode auto-disarms the picker", () => {
      const { manager } = makeManager();

      manager.tools.brush.pickArmed = true;
      manager.mode = "fill";

      assert.ok(!manager.tools.brush.pickArmed);
      manager.destroy();
    });

    test("tools.brush.pick samples directly regardless of mode, ignoring the armed flag", () => {
      const { manager } = makeManager();
      manager.mode = "select";

      const color = manager.tools.brush.pick(4, 4);

      assert.deepStrictEqual(
        color,
        { r: 0x12, g: 0x34, b: 0x56, a: 255 }
      );
      assert.strictEqual(
        manager.brush.primary.asString("hex"),
        "#123456"
      );
      manager.destroy();
    });

    test("tools.brush.pick returns null and leaves the brush untouched outside the texture", () => {
      const { manager } = makeManager();

      const color = manager.tools.brush.pick(-1, -1);

      assert.strictEqual(color, null);
      assert.strictEqual(
        manager.brush.primary.asString("hex"),
        "#000000"
      );
      manager.destroy();
    });
  });
});
