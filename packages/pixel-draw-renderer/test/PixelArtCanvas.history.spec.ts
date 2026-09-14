// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type HistoryState
} from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { makeContainer } from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { readPixel } from "./fixtures/canvas.ts";

function paintOnePixel(
  canvas: HTMLCanvasElement,
  positions: [number, number][]
): void {
  const [firstX, firstY] = positions[0];
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button: 0,
    buttons: 1,
    clientX: firstX,
    clientY: firstY,
    bubbles: true
  }));

  for (const [x, y] of positions.slice(1)) {
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: x,
      clientY: y,
      bubbles: true
    }));
  }

  canvas.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true
  }));
}

describe("PixelArtCanvas — history (undo/redo)", () => {
  let container: HTMLDivElement;
  let children: HTMLCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
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
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);

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

      // (88,88) -> texture (1,1)
      paintOnePixel(canvas, [[88, 88]]);
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

    test("undo/redo re-emit onBufferUpdated so network sync stays consistent", () => {
      const events: PixelBufferHookEvent[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        brush: {
          size: 1,
          maxSize: 1
        },
        history: {
          enabled: true
        },
        onBufferUpdated: (event) => events.push(event)
      });

      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(events.length, 1);

      manager.undo();
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[1].action, "stroke");

      manager.redo();
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[2].action, "stroke");
      manager.destroy();
    });

    test("a new edit after undo clears the redo stack", () => {
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
          enabled: true
        }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      manager.undo();
      assert.ok(manager.canRedo());

      paintOnePixel(canvas, [[92, 88]]);
      assert.ok(!manager.canRedo());
      manager.destroy();
    });
  });

  describe("global fill round trip", () => {
    test("undo reverts a global fill to the exact pre-fill colors; redo re-applies it", () => {
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
        }
      });
      manager.tools.fill.global = true;

      // 4x4 texture, zoom 4 -> centered camera (92,92); client(100,100) -> texture (2,2).
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
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
      manager.destroy();
    });

    test("undo/redo of a global fill re-emit onBufferUpdated as a full-position 'stroke' event", () => {
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
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "global-fill");

      manager.undo();
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[1].action, "stroke");

      manager.redo();
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[2].action, "stroke");
      manager.destroy();
    });
  });

  describe("onHistoryChange", () => {
    test("fires after a push, an undo, and a redo", () => {
      const states: HistoryState[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        brush: {
          size: 1,
          maxSize: 1
        },
        history: {
          enabled: true,
          limit: 1
        },
        onHistoryChange: (state) => states.push(state)
      });

      paintOnePixel(canvas, [[88, 88]]);
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      manager.undo();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: true }
      );

      manager.redo();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
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
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      paintOnePixel(canvas, [[92, 88]]);

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

  describe("clearing on remote structural changes", () => {
    test("a remote 'resized' command clears the local undo stack", () => {
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
          enabled: true
        }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.ok(manager.canUndo());

      manager.applyRemoteCommand({
        action: "resized",
        metadata: { size: { x: 4, y: 4 } }
      });
      assert.ok(!manager.canUndo());
      manager.destroy();
    });

    test("a remote 'texture-replaced' command clears the local undo stack", () => {
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
          enabled: true
        }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.ok(manager.canUndo());

      const pixels = new Uint8ClampedArray(
        2 * 2 * 4
      ).fill(200);
      const base64 = Buffer.from(pixels).toString("base64");
      manager.applyRemoteCommand({
        action: "texture-replaced",
        metadata: {
          size: { x: 2, y: 2 },
          pixels: base64
        }
      });
      assert.ok(!manager.canUndo());
      manager.destroy();
    });

    test("loadSnapshot clears the local undo stack", () => {
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
          enabled: true
        }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.ok(manager.canUndo());

      manager.loadSnapshot(
        { x: 3, y: 3 },
        new Uint8ClampedArray(3 * 3 * 4)
      );
      assert.ok(!manager.canUndo());
      manager.destroy();
    });

    test("a remote 'stroke' command does NOT clear the local undo stack", () => {
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
          enabled: true
        }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.ok(manager.canUndo());

      manager.applyRemoteCommand({
        action: "stroke",
        metadata: {
          color: { r: 9, g: 8, b: 7, a: 255 },
          positions: [{ x: 0, y: 0 }]
        }
      });
      assert.ok(manager.canUndo());
      manager.destroy();
    });
  });
});
