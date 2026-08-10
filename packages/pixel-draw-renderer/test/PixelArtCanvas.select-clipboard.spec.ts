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
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { ClipboardAdapter } from "#src/clipboard/types.ts";
import {
  mockContextOf,
  readPixel
} from "./fixtures/canvas.ts";
import { makeContainer } from "./helpers/dom.ts";
import {
  mouseEvent,
  ctrlKey
} from "./helpers/events.ts";

function makeClipboardItem(
  data: Record<string, Blob>
): ClipboardItem {
  return {
    types: Object.keys(data),
    presentationStyle: "unspecified",
    getType: async(type: string) => data[type]
  };
}

function makeRasterClipboard(): ClipboardAdapter {
  return {
    read: async() => [makeClipboardItem({
      "image/png": new Blob(["png"], { type: "image/png" })
    })],
    write: async() => undefined
  };
}

async function withBitmapSource<T>(
  source: HTMLCanvasElement,
  run: () => Promise<T>
): Promise<T> {
  const previous = globalThis.createImageBitmap;
  const bitmap = Object.assign(source, {
    close: () => undefined
  });
  Object.assign(globalThis, {
    createImageBitmap: async() => bitmap
  });

  try {
    return await run();
  }
  finally {
    Object.assign(globalThis, {
      createImageBitmap: previous
    });
  }
}

function canvasPlaceSelection(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(mouseEvent("mousedown", clientX, clientY));
  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

describe("PixelArtCanvas — select mode clipboard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  // 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
  // client 84 + n*4 -> texture n, exactly (chosen to land on pixel starts,
  // no floor-rounding ambiguity).

  function makeManager(
    options: PixelArtCanvasOptions = {}
  ): PixelArtCanvas {
    return new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      zoom: { default: 4 },
      ...options
    });
  }

  test("copy then paste duplicates in place; moving the duplicate away leaves the original untouched", async() => {
    const manager = makeManager();
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

    // The cursor never left the source, so the duplicate landed back on it
    // and is now the active selection. Dragging it away must relocate only
    // the *duplicate*, leaving the original in place. (Regression: a naive
    // move erases its source unconditionally, which would wipe out the
    // original here since source === original spot.)
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
    manager.destroy();
  });

  test("moving an already-relocated duplicate a second time erases its (now real) previous spot", async() => {
    const manager = makeManager();
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

    // First move: relocates the duplicate to (4,4), original at (2,2) survives.
    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    // Second move: the duplicate now legitimately owns (4,4) — moving it
    // again to (6,6) must erase (4,4) for real this time.
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

  test("Ctrl+V without a prior Ctrl+C is a no-op", () => {
    const manager = makeManager();
    const before = manager.texture.slice();

    window.dispatchEvent(ctrlKey("v"));

    assert.deepStrictEqual(
      manager.texture,
      before
    );
    manager.destroy();
  });

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
    const manager = makeManager({
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
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 92, 92));
    manager.canvas().dispatchEvent(mouseEvent("mousemove", 10, 10));
    await withBitmapSource(source, () => manager.pasteClipboard());

    // 8x8 texture centred at zoom 4 in a 200x200 container: view centre (4,4).
    canvasPlaceSelection(manager.canvas(), 100, 100);

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [12, 34, 56, 255]
    );
    manager.destroy();
  });

  test("a paste too large for the texture is pinned to the origin, keeping its overflow", async() => {
    // 10 wide on an 8-wide texture: it cannot be centred anywhere, so its
    // top-left is pinned in view and the tail hangs off the right edge.
    const source = document.createElement("canvas");
    source.width = 10;
    source.height = 1;
    const context = mockContextOf(source);
    context.fillStyle = "rgba(255, 0, 0, 1)";
    context.fillRect(0, 0, 10, 1);
    context.fillStyle = "rgba(0, 0, 255, 1)";
    context.fillRect(9, 0, 1, 1);
    const manager = makeManager({
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

    // Dragging left by 2 walks the overflowed tail back into range.
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 76, 84));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 7, y: 0 }, 8),
      [0, 0, 255, 255],
      "the 10th column was retained and is now in bounds"
    );
    manager.destroy();
  });

  test("delete cancels an uncommitted paste without changing the texture", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });
    const before = manager.texture;

    await withBitmapSource(source, () => manager.pasteClipboard());
    assert.strictEqual(manager.tools.select.delete(), true);

    assert.deepStrictEqual(manager.texture, before);
    assert.strictEqual(manager.tools.select.hasSelection, false);
    manager.destroy();
  });

  test("a paste near an edge is pulled fully into bounds instead of hanging off it", async() => {
    const source = document.createElement("canvas");
    source.width = 4;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(255, 0, 0, 1)";
    source.getContext("2d")!.fillRect(0, 0, 4, 1);
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });
    const canvas = manager.canvas();

    // Cursor at texture (0,0): centring alone would put the rect at x=-2.
    canvas.dispatchEvent(mouseEvent("mousemove", 84, 84));
    await withBitmapSource(source, () => manager.pasteClipboard());
    canvasPlaceSelection(canvas, 84, 84);

    for (let x = 0; x < 4; x++) {
      assert.deepStrictEqual(
        readPixel(manager.texture, { x, y: 0 }, 8),
        [255, 0, 0, 255],
        `column ${x} landed inside the texture`
      );
    }
    manager.destroy();
  });

  test("transparent and oversized images leave mode and texture unchanged", async() => {
    const transparent = document.createElement("canvas");
    transparent.width = 1;
    transparent.height = 1;
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });
    const before = manager.texture;

    const emptyResult = await withBitmapSource(
      transparent,
      () => manager.pasteClipboard()
    );

    assert.strictEqual(emptyResult.code, "image-empty");
    assert.strictEqual(manager.mode, "paint");
    assert.deepStrictEqual(manager.texture, before);

    const oversized = document.createElement("canvas");
    oversized.width = 33;
    oversized.height = 1;
    const oversizedManager = makeManager({
      clipboard: makeRasterClipboard()
    });
    const oversizedBefore = oversizedManager.texture;
    const oversizedResult = await withBitmapSource(
      oversized,
      () => oversizedManager.pasteClipboard()
    );

    assert.strictEqual(oversizedResult.code, "image-too-large");
    assert.strictEqual(oversizedResult.maxSize, 32);
    assert.strictEqual(oversizedManager.mode, "paint");
    assert.deepStrictEqual(oversizedManager.texture, oversizedBefore);
    manager.destroy();
    oversizedManager.destroy();
  });

  test("publishes selection availability for creation, mode exit, and texture replacement", () => {
    const manager = makeManager();
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

  test("a paste whose opaque pixels touch only diagonally still yields a live selection", async() => {
    // The contour tracer used to throw on a corner-touching mask, aborting
    // importSelection after the pixels were floating but before the outline
    // was drawn and the state published: no marching ants, a toolbar that
    // believed nothing was selected, yet draggable pixels.
    const source = document.createElement("canvas");
    source.width = 2;
    source.height = 2;
    const context = mockContextOf(source);
    context.fillStyle = "rgba(255, 0, 0, 1)";
    context.fillRect(0, 0, 1, 1);
    context.fillRect(1, 1, 1, 1);
    const states: boolean[] = [];
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });
    manager.selectionEvents.on(
      "selection-state-changed",
      ({ hasSelection }) => states.push(hasSelection)
    );

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 92, 92));
    const result = await withBitmapSource(
      source,
      () => manager.pasteClipboard()
    );

    assert.strictEqual(result.code, "pasted");
    assert.strictEqual(manager.tools.select.hasSelection, true);
    assert.deepStrictEqual(
      states,
      [true],
      "the selection is published, so the toolbar enables"
    );
    manager.destroy();
  });

  test("deselecting a floating paste deposits it instead of dropping it", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    await withBitmapSource(source, () => manager.pasteClipboard());

    // Click far away: a new marquee starts, and the paste lands rather than
    // vanishing.
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
    const manager = makeManager({
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
    const manager = makeManager({
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

  test("a failed import reports paste-failed and hands the mode back", async() => {
    const manager = makeManager({
      clipboard: makeRasterClipboard()
    });
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);

    const original = manager.tools.select.importSelection;
    Object.assign(manager.tools.select, {
      importSelection: () => {
        throw new Error("boom");
      }
    });

    const result = await withBitmapSource(
      source,
      () => manager.pasteClipboard()
    );
    Object.assign(manager.tools.select, { importSelection: original });

    assert.strictEqual(result.code, "paste-failed");
    assert.strictEqual(manager.mode, "paint", "mode rolled back");
    assert.strictEqual(manager.tools.select.hasSelection, false);
    manager.destroy();
  });

  test("publishes isFloating so a UI can tell a pending paste from a plain selection", async() => {
    const source = document.createElement("canvas");
    source.width = 1;
    source.height = 1;
    mockContextOf(source).fillStyle = "rgba(12, 34, 56, 1)";
    source.getContext("2d")!.fillRect(0, 0, 1, 1);
    const manager = makeManager({
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
    // Dropping it in place deposits it: still selected, no longer floating.
    canvasPlaceSelection(canvas, 92, 92);

    assert.deepStrictEqual(states, [
      { hasSelection: true, isFloating: true },
      { hasSelection: true, isFloating: false }
    ]);
    manager.destroy();
  });

  test("allows only one clipboard operation at a time", async() => {
    const deferred = Promise.withResolvers<ClipboardItem[]>();
    const manager = makeManager({
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
