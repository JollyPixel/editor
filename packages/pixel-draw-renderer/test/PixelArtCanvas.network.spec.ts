// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { makeContainer } from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { stroke } from "./helpers/events.ts";

describe("PixelArtCanvas — onBufferUpdated", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("stroke", () => {
    test("emits a single 'stroke' event on mouseup, deduped across moves", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        zoom: { default: 4 },
        brush: { size: 1, maxSize: 1 },
        onBufferUpdated: (event) => events.push(event)
      });

      stroke(
        canvas,
        [[88, 88], [92, 88], [88, 88]]
      );

      assert.strictEqual(events.length, 1);
      const event = events[0];
      assert.strictEqual(event.action, "stroke");
      if (event.action !== "stroke") {
        return;
      }
      assert.deepStrictEqual(
        event.metadata.color,
        { r: 0, g: 0, b: 0, a: 255 }
      );
      assert.deepStrictEqual(
        event.metadata.positions,
        [
          { x: 1, y: 1 },
          { x: 2, y: 1 }
        ]
      );

      manager.destroy();
    });
  });

  describe("resized", () => {
    test("setTextureSize emits a 'resized' event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.textureSize = { x: 16, y: 4 };

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "resized");
      if (events[0].action === "resized") {
        assert.deepStrictEqual(
          events[0].metadata.size,
          { x: 16, y: 4 }
        );
      }
      manager.destroy();
    });

    test("invalid size does not emit an event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
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
      const { manager, canvas } = createPixelArtCanvas({
        texture: {
          size: { x: 16, y: 16 }
        },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        onBufferUpdated: (event) => events.push(event)
      });
      manager.tools.fill.global = true;

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(events.length, 1);
      const event = events[0];
      assert.strictEqual(event.action, "global-fill");
      if (event.action !== "global-fill") {
        return;
      }
      assert.deepStrictEqual(
        event.metadata.fromColor,
        { r: 255, g: 255, b: 255, a: 255 }
      );
      assert.deepStrictEqual(
        event.metadata.toColor,
        { r: 255, g: 0, b: 0, a: 255 }
      );
      manager.destroy();
    });
  });

  describe("texture-replaced", () => {
    test("setTexture emits a 'texture-replaced' event with decodable base64 pixels", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 4, y: 4 }
        },
        onBufferUpdated: (event) => events.push(event)
      });

      const externalCanvas = document.createElement("canvas");
      externalCanvas.width = 4;
      externalCanvas.height = 4;
      manager.texture = externalCanvas;

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "texture-replaced");
      if (events[0].action !== "texture-replaced") {
        return;
      }
      assert.deepStrictEqual(
        events[0].metadata.size,
        { x: 4, y: 4 }
      );
      assert.strictEqual(
        toUint8Array(events[0].metadata.pixels).length,
        4 * 4 * 4
      );
      manager.destroy();
    });
  });
});

describe("PixelArtCanvas — applyRemoteCommand", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  test(
    "select-edit: applies each position's own color without re-emitting onBufferUpdated (echo guard)",
    () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.applyRemoteCommand({
        action: "select-edit",
        metadata: {
          positions: [
            { x: 0, y: 0 },
            { x: 1, y: 0 }
          ],
          colors: [
            { r: 1, g: 2, b: 3, a: 255 },
            { r: 9, g: 8, b: 7, a: 255 }
          ]
        }
      });

      assert.strictEqual(events.length, 0);
      assert.deepStrictEqual(
        [...manager.texture.subarray(0, 4)],
        [1, 2, 3, 255]
      );
      assert.deepStrictEqual(
        [...manager.texture.subarray(4, 8)],
        [9, 8, 7, 255]
      );
      manager.destroy();
    }
  );

  test("global-fill: recomputes matching pixels from fromColor and repaints them toColor", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 4, y: 4 }
      },
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
    const [r, g, b, a] = manager.texture.subarray(4, 8);
    assert.deepStrictEqual(
      [r, g, b, a],
      [9, 8, 7, 255]
    );
    manager.destroy();
  });
});
