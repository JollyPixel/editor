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
import { readPixel } from "./fixtures/canvas.ts";

function paintOnePixel(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    bubbles: true
  }));
  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

describe("PixelArtCanvas — fill mode", () => {
  let container: HTMLDivElement;
  let children: HTMLCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
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

    test("clicking a region already matching the brush color is a no-op", () => {
      const events: unknown[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        texture: {
          size: { x: 16, y: 16 }
        },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FFFFFF" },
        onBufferUpdated: (event) => events.push(event)
      });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(events.length, 0, "fill color already matches the target region's color");
      manager.destroy();
    });

    test("a second click after the first fill is also a no-op (region now matches fill color)", () => {
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

      function click(): void {
        canvas.dispatchEvent(new MouseEvent("mousedown", {
          button: 0,
          buttons: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true
        }));
      }

      click();
      click();

      assert.strictEqual(events.length, 1, "second click on the now-red region is a no-op");
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
        const canvas = children[0];

        paintOnePixel(canvas, 98, 98);
        paintOnePixel(canvas, 102, 102);
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
      const canvas = children[0];

      paintOnePixel(canvas, 98, 98);
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

  describe("tools.fill.uvClip", () => {
    const kWhite = [255, 255, 255, 255];
    const kRed = [255, 0, 0, 255];

    function fillAt(
      canvas: HTMLCanvasElement,
      position: { x: number; y: number; }
    ): void {
      paintOnePixel(canvas, 96 + position.x, 96 + position.y);
    }

    function makeClipped(
      events: PixelBufferHookEvent[] = []
    ) {
      const created = createPixelArtCanvas({
        zoom: { default: 1 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        history: { enabled: true },
        onBufferUpdated: (event) => events.push(event)
      });
      created.manager.tools.fill.uvClip = true;

      return created;
    }

    function pixelAt(
      manager: PixelArtCanvas,
      position: { x: number; y: number; }
    ): number[] {
      return readPixel(manager.texture, position, 8);
    }

    test("defaults to false", () => {
      const { manager } = createPixelArtCanvas();

      assert.strictEqual(manager.tools.fill.uvClip, false);
      manager.destroy();
    });

    test("a slot edge stops a same-color flood seeded inside the slot", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = makeClipped(events);
      manager.uv.restore({
        id: "slot",
        color: "#00f",
        state: "stacked",
        rect: { x: 2, y: 2, width: 3, height: 3 }
      });

      events.length = 0;
      fillAt(canvas, { x: 3, y: 3 });

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "stroke");
      assert.strictEqual(
        events[0].action === "stroke" && events[0].metadata.positions.length,
        9
      );
      assert.deepStrictEqual(pixelAt(manager, { x: 2, y: 2 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 4, y: 4 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 1, y: 3 }), kWhite);
      assert.deepStrictEqual(pixelAt(manager, { x: 5, y: 3 }), kWhite);
      manager.destroy();
    });

    test("a seed outside every slot skips the slots and fills net gaps", () => {
      const { manager, canvas } = makeClipped();
      manager.uv.restore({
        id: "net",
        color: "#00f",
        state: "unfolded",
        faces: {
          front: { x: 1, y: 1, width: 2, height: 2 },
          back: { x: 5, y: 1, width: 2, height: 2 }
        }
      });

      fillAt(canvas, { x: 7, y: 7 });

      assert.deepStrictEqual(pixelAt(manager, { x: 1, y: 1 }), kWhite);
      assert.deepStrictEqual(pixelAt(manager, { x: 6, y: 2 }), kWhite);
      assert.deepStrictEqual(pixelAt(manager, { x: 3, y: 1 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 4, y: 2 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 7, y: 7 }), kRed);
      manager.destroy();
    });

    test("overlapping slots fill as a union", () => {
      const { manager, canvas } = makeClipped();
      manager.uv.restore({
        id: "left",
        color: "#00f",
        state: "stacked",
        rect: { x: 1, y: 1, width: 3, height: 2 }
      });
      manager.uv.restore({
        id: "right",
        color: "#0f0",
        state: "stacked",
        rect: { x: 3, y: 1, width: 3, height: 2 }
      });

      fillAt(canvas, { x: 3, y: 1 });

      assert.deepStrictEqual(pixelAt(manager, { x: 1, y: 2 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 5, y: 2 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 0, y: 1 }), kWhite);
      assert.deepStrictEqual(pixelAt(manager, { x: 6, y: 1 }), kWhite);
      assert.deepStrictEqual(pixelAt(manager, { x: 1, y: 3 }), kWhite);
      manager.destroy();
    });

    test("a clipped global fill emits a stroke, never global-fill", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = makeClipped(events);
      manager.tools.fill.global = true;
      manager.uv.restore({
        id: "slot",
        color: "#00f",
        state: "stacked",
        rect: { x: 2, y: 2, width: 2, height: 2 }
      });

      events.length = 0;
      fillAt(canvas, { x: 2, y: 2 });

      assert.deepStrictEqual(
        events.map((event) => event.action),
        ["stroke"]
      );
      assert.deepStrictEqual(
        events[0].action === "stroke" && events[0].metadata.color,
        { r: 255, g: 0, b: 0, a: 255 }
      );
      assert.deepStrictEqual(pixelAt(manager, { x: 3, y: 3 }), kRed);
      assert.deepStrictEqual(pixelAt(manager, { x: 6, y: 6 }), kWhite);
      manager.destroy();
    });

    test("an unclipped global fill still emits global-fill", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = makeClipped(events);
      manager.tools.fill.global = true;
      manager.tools.fill.uvClip = false;
      manager.uv.restore({
        id: "slot",
        color: "#00f",
        state: "stacked",
        rect: { x: 2, y: 2, width: 2, height: 2 }
      });

      events.length = 0;
      fillAt(canvas, { x: 2, y: 2 });

      assert.deepStrictEqual(
        events.map((event) => event.action),
        ["global-fill"]
      );
      manager.destroy();
    });

    test("undo restores a clipped fill", () => {
      const { manager, canvas } = makeClipped();
      manager.uv.restore({
        id: "slot",
        color: "#00f",
        state: "stacked",
        rect: { x: 2, y: 2, width: 3, height: 3 }
      });
      const before = manager.texture;

      fillAt(canvas, { x: 3, y: 3 });
      assert.deepStrictEqual(pixelAt(manager, { x: 3, y: 3 }), kRed);

      assert.ok(manager.undo());
      assert.deepStrictEqual(manager.texture, before);
      manager.destroy();
    });

    for (const global of [false, true]) {
      test(`without regions matches a plain fill (global: ${global})`, () => {
        const plainEvents: PixelBufferHookEvent[] = [];
        const clippedEvents: PixelBufferHookEvent[] = [];
        const plain = makeClipped(plainEvents);
        plain.manager.tools.fill.uvClip = false;
        plain.manager.tools.fill.global = global;
        fillAt(plain.canvas, { x: 3, y: 3 });
        const plainTexture = plain.manager.texture;
        plain.manager.destroy();

        const clipped = makeClipped(clippedEvents);
        clipped.manager.tools.fill.global = global;
        fillAt(clipped.canvas, { x: 3, y: 3 });

        assert.deepStrictEqual(clipped.manager.texture, plainTexture);
        assert.deepStrictEqual(
          clippedEvents.map((event) => event.action),
          plainEvents.map((event) => event.action)
        );
        clipped.manager.destroy();
      });
    }
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
      const canvas = children[0];
      const svg = children[1] as unknown as SVGElement;
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

    test("a contextmenu event alone does not pick a color", () => {
      const { manager, canvas } = makeManager();

      let fired = false;
      canvas.addEventListener("colorpicked", () => {
        fired = true;
      });

      canvas.dispatchEvent(
        new MouseEvent("contextmenu", {
          clientX: 100,
          clientY: 100,
          bubbles: true
        })
      );

      assert.ok(!fired);
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
