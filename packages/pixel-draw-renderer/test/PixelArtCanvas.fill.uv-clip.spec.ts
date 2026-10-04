// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { stroke } from "./helpers/events.ts";
import { readPixel } from "./fixtures/canvas.ts";

describe("PixelArtCanvas — fill mode", () => {
  describe("tools.fill.uvClip", () => {
    const kWhite = [255, 255, 255, 255];
    const kRed = [255, 0, 0, 255];

    function fillAt(
      canvas: HTMLCanvasElement,
      position: { x: number; y: number; }
    ): void {
      stroke(canvas, [[96 + position.x, 96 + position.y]]);
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
});
