// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  mockContextOf,
  readPixel
} from "./fixtures/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import {
  canvasPlaceSelection,
  makeRasterClipboard,
  withBitmapSource
} from "./helpers/select-canvas/clipboard.ts";
import { createSelectCanvas } from "./helpers/select-canvas/manager.ts";

describe("PixelArtCanvas — select mode external paste", () => {
  test("external paste uses the current cursor, preserves alpha, and switches modes", async() => {
    const source = document.createElement("canvas");
    source.width = 2;
    source.height = 1;
    const imageData = source.getContext("2d")!.createImageData(2, 1);
    imageData.data.set([
      10, 20, 30, 0,
      40, 50, 60, 128
    ]);
    source.getContext("2d")!.putImageData(imageData, 0, 0);
    const modeChanges: string[] = [];
    const results: string[] = [];
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard(),
      onModeChange: (mode) => modeChanges.push(mode),
      onClipboardResult: (result) => results.push(result.code)
    });

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 96, 100));
    const result = await withBitmapSource(
      source,
      () => manager.pasteClipboard()
    );

    assert.strictEqual(result.code, "pasted");
    assert.strictEqual(manager.mode, "select");
    assert.deepStrictEqual(modeChanges, ["select"]);
    assert.deepStrictEqual(results, ["pasted"]);
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 4 }, 8),
      [255, 255, 255, 255],
      "paste remains floating until the selection is placed"
    );

    canvasPlaceSelection(manager.canvas(), 96, 100);

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 4 }, 8),
      [255, 255, 255, 255],
      "alpha-zero pixels do not erase the destination"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 4 }, 8),
      [40, 50, 60, 128],
      "partial alpha is stored without blending"
    );
    manager.destroy();
  });

  test("external paste falls back to the visible view centre once the cursor leaves the texture", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 92, 92));
    manager.canvas().dispatchEvent(mouseEvent("mousemove", 10, 10));
    await withBitmapSource(source, () => manager.pasteClipboard());

    const viewCentre = { clientX: 100, clientY: 100 };
    canvasPlaceSelection(
      manager.canvas(),
      viewCentre.clientX,
      viewCentre.clientY
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [12, 34, 56, 255]
    );
    manager.destroy();
  });

  test("a paste too large for the texture is pinned to the origin, keeping its overflow", async() => {
    const source = document.createElement("canvas");
    source.width = 10;
    source.height = 1;
    const context = mockContextOf(source);
    context.fillStyle = "rgba(255, 0, 0, 1)";
    context.fillRect(0, 0, 10, 1);
    context.fillStyle = "rgba(0, 0, 255, 1)";
    context.fillRect(9, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousemove", 108, 84));
    await withBitmapSource(source, () => manager.pasteClipboard());
    canvasPlaceSelection(canvas, 84, 84);

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 0, y: 0 }, 8),
      [255, 0, 0, 255],
      "pinned to x=0 regardless of where the cursor was"
    );

    canvas.dispatchEvent(mouseEvent("mousedown", 86, 86));
    canvas.dispatchEvent(mouseEvent("mousemove", 78, 86));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 7, y: 0 }, 8),
      [0, 0, 255, 255],
      "dragging left by 2 brings the retained 10th column back in bounds"
    );
    manager.destroy();
  });

  test("delete cancels an uncommitted paste without changing the texture", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const before = manager.texture;

    await withBitmapSource(source, () => manager.pasteClipboard());
    assert.strictEqual(manager.tools.select.delete(), true);

    assert.deepStrictEqual(manager.texture, before);
    assert.strictEqual(manager.tools.select.hasSelection, false);
    manager.destroy();
  });

  test("deselecting a floating paste deposits it instead of dropping it", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    await withBitmapSource(source, () => manager.pasteClipboard());

    canvas.dispatchEvent(mouseEvent("mousedown", 108, 108));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [12, 34, 56, 255]
    );
    manager.destroy();
  });

  test("leaving select mode deposits a floating paste", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 92, 92));
    await withBitmapSource(source, () => manager.pasteClipboard());
    manager.mode = "paint";

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [12, 34, 56, 255]
    );
    manager.destroy();
  });

  test("pasting again deposits the previous paste", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    await withBitmapSource(source, () => manager.pasteClipboard());
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    await withBitmapSource(source, () => manager.pasteClipboard());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [12, 34, 56, 255],
      "the first paste was deposited, not discarded"
    );
    assert.strictEqual(
      manager.tools.select.isFloating,
      true,
      "the second paste is still floating"
    );
    manager.destroy();
  });

  test("publishes isFloating, and dropping a paste in place deposits it but keeps it selected", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = createSelectCanvas({
      clipboard: makeRasterClipboard()
    });
    const canvas = manager.canvas();
    const states: { hasSelection: boolean; isFloating: boolean; }[] = [];
    manager.selectionEvents.on(
      "selection-state-changed",
      (event) => states.push(event)
    );

    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    await withBitmapSource(source, () => manager.pasteClipboard());
    canvasPlaceSelection(canvas, 92, 92);

    assert.deepStrictEqual(states, [
      { hasSelection: true, isFloating: true },
      { hasSelection: true, isFloating: false }
    ]);
    manager.destroy();
  });
});
