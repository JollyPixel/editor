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

describe("PixelArtCanvas — history (undo/redo)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("disabled by default", () => {
    test("undo()/redo() are no-ops and canUndo()/canRedo() stay false", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        brush: {
          size: 1,
          maxSize: 1
        }
      });
      const canvas = manager.canvas();

      stroke(canvas, [[88, 88]]);

      assert.ok(!manager.canUndo());
      assert.ok(!manager.undo());
      assert.ok(!manager.canRedo());
      assert.ok(!manager.redo());
      manager.destroy();
    });
  });

  describe("enabled — stroke round trip", () => {
    test("undo reverts a painted pixel; redo re-applies it", () => {
      const { manager, canvas } = createPixelArtCanvas({
        zoom: {
          default: 4
        },
        brush: {
          size: 1,
          maxSize: 1
        },
        history: {
          enabled: true
        }
      });

      stroke(canvas, [[88, 88]]);
      assert.ok(manager.canUndo());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 1, y: 1 }, 8),
        [0, 0, 0, 255]
      );

      assert.ok(manager.undo());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 1, y: 1 }, 8),
        [255, 255, 255, 255]
      );
      assert.ok(!manager.canUndo());
      assert.ok(manager.canRedo());

      assert.ok(manager.redo());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 1, y: 1 }, 8),
        [0, 0, 0, 255]
      );
      assert.ok(!manager.canRedo());
      manager.destroy();
    });
  });

  describe("global fill round trip", () => {
    test("undo/redo of a global fill restores the exact colors and re-emits a full-position stroke", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        texture: {
          size: { x: 4, y: 4 }
        },
        zoom: {
          default: 4
        },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        history: {
          enabled: true
        },
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
      assert.ok(manager.canUndo());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 4),
        [255, 0, 0, 255]
      );

      assert.ok(manager.undo());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 4),
        [255, 255, 255, 255]
      );
      assert.ok(manager.canRedo());

      assert.ok(manager.redo());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 4),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        events.map((event) => event.action),
        ["global-fill", "stroke", "stroke"]
      );
      manager.destroy();
    });
  });

  describe("limit", () => {
    test("only the configured number of most-recent edits are undoable", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        brush: {
          size: 1,
          maxSize: 1
        },
        history: {
          enabled: true,
          limit: 1
        }
      });
      const canvas = manager.canvas();

      stroke(canvas, [[88, 88]]);
      stroke(canvas, [[92, 88]]);

      assert.ok(manager.undo());
      assert.ok(!manager.undo());
      manager.destroy();
    });
  });

  describe("resized / texture-replaced", () => {
    test("undo restores the previous texture size", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        history: {
          enabled: true
        }
      });

      manager.textureSize = { x: 4, y: 4 };
      assert.deepStrictEqual(
        manager.textureSize,
        { x: 4, y: 4 }
      );

      manager.undo();
      assert.deepStrictEqual(
        manager.textureSize,
        { x: 8, y: 8 }
      );
      manager.destroy();
    });
  });
});
