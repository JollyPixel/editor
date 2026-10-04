// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { SelectEngine } from "#src/tools/SelectEngine.ts";
import type { ClipboardOperationResult } from "#src/clipboard/types.ts";
import {
  mockContextOf,
  readPixel
} from "./fixtures/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import {
  makeRasterClipboard,
  withBitmapSource
} from "./helpers/select-canvas/clipboard.ts";
import { createSelectCanvas } from "./helpers/select-canvas/manager.ts";

describe("PixelArtCanvas — select mode clipboard", () => {
  test("a pasted duplicate's first move keeps the original, its second erases its previous spot", async() => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 96, 92)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    await manager.copySelection();
    await manager.pasteClipboard();

    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "original survives the duplicate's first move"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "duplicate landed at destination"
    );

    canvas.dispatchEvent(
      mouseEvent("mousedown", 100, 100)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 108, 108)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "original still untouched"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [255, 255, 255, 255],
      "second move erases the duplicate's now-real previous spot, with the dominant (white) surrounding color"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 6, y: 6 }, 8),
      [0, 0, 0, 255],
      "duplicate landed at the new destination"
    );
    manager.destroy();
  });

  test("the paste shortcut without a prior copy reports no-image and keeps the mode", async() => {
    const results: ClipboardOperationResult[] = [];
    const manager = createSelectCanvas({
      clipboard: null,
      onClipboardResult: (result) => results.push(result)
    });

    assert.strictEqual(manager.shortcuts.paste(), true);
    await setImmediate();

    assert.deepStrictEqual(results, [
      {
        operation: "paste",
        code: "no-image"
      }
    ]);
    assert.strictEqual(manager.mode, "paint");
    manager.destroy();
  });

  test("the copy shortcut is refused without a selection and copies one when present", async() => {
    const results: ClipboardOperationResult[] = [];
    const manager = createSelectCanvas({
      clipboard: null,
      onClipboardResult: (result) => results.push(result)
    });
    const canvas = manager.canvas();

    assert.strictEqual(manager.shortcuts.copy(), false);
    await setImmediate();
    assert.deepStrictEqual(results, []);

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(manager.shortcuts.copy(), true);
    await setImmediate();

    assert.deepStrictEqual(results, [
      {
        operation: "copy",
        code: "copied-internal-only",
        source: "internal"
      }
    ]);
    manager.destroy();
  });

  test("transparent and oversized images are rejected and leave the mode unchanged", async() => {
    const transparent = document.createElement("canvas");
    transparent.width = 1;
    transparent.height = 1;
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });

    const emptyResult = await withBitmapSource(
      transparent,
      () => manager.pasteClipboard()
    );

    assert.strictEqual(emptyResult.code, "image-empty");
    assert.strictEqual(manager.mode, "paint");

    const oversized = document.createElement("canvas");
    oversized.width = 33;
    oversized.height = 1;
    const oversizedManager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const oversizedResult = await withBitmapSource(
      oversized,
      () => oversizedManager.pasteClipboard()
    );

    assert.strictEqual(oversizedResult.code, "image-too-large");
    assert.strictEqual(oversizedResult.maxSize, 32);
    assert.strictEqual(oversizedManager.mode, "paint");
    manager.destroy();
    oversizedManager.destroy();
  });

  test("publishes selection availability for creation, mode exit, and texture replacement", () => {
    const manager = createSelectCanvas();
    const canvas = manager.canvas();
    const states: boolean[] = [];
    manager.selectionEvents.on(
      "selection-state-changed",
      ({ hasSelection }) => states.push(hasSelection)
    );

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    manager.mode = "paint";

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    const replacement = document.createElement("canvas");
    replacement.width = 8;
    replacement.height = 8;
    manager.texture = replacement;

    assert.deepStrictEqual(states, [true, false, true, false]);
    manager.destroy();
  });

  test("a failed import reports paste-failed and hands the mode back", async(
    context
  ) => {
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);

    context.mock.method(
      SelectEngine.prototype,
      "importSelection",
      () => {
        throw new Error("boom");
      }
    );

    const result = await withBitmapSource(
      source,
      () => manager.pasteClipboard()
    );
    assert.strictEqual(result.code, "paste-failed");
    assert.strictEqual(manager.mode, "paint", "mode rolled back");
    assert.strictEqual(manager.tools.select.hasSelection, false);
    manager.destroy();
  });

  test("allows only one clipboard operation at a time", async() => {
    const deferred = Promise.withResolvers<ClipboardItem[]>();
    const manager = createSelectCanvas({
      clipboard: {
        read: () => deferred.promise,
        write: async() => undefined
      }
    });

    const first = manager.pasteClipboard();
    const busy = await manager.pasteClipboard();
    assert.strictEqual(busy.code, "busy");
    assert.strictEqual(manager.mode, "paint");

    deferred.resolve([]);
    assert.strictEqual((await first).code, "no-image");
    manager.destroy();
  });
});
