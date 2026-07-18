// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { CanvasManager, type CanvasManagerOptions } from "../src/CanvasManager.ts";
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
  installCanvasMock(globalThis.document);
  globalThis.MouseEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).MouseEvent as typeof MouseEvent;
  globalThis.KeyboardEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).KeyboardEvent as typeof KeyboardEvent;
  globalThis.HTMLElement = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).HTMLElement as typeof HTMLElement;
  globalThis.Event = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).Event as typeof Event;
});

function makeContainer(): HTMLDivElement {
  const div = kEmulatedBrowserWindow.document.createElement("div") as unknown as HTMLDivElement;
  (div as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };
  (div as any).style = {};
  (div as any).appendChild = (_child: unknown) => {
    // No-op
  };

  return div;
}

function readPixel(
  pixels: Uint8ClampedArray,
  pos: { x: number; y: number; },
  width: number
): [number, number, number, number] {
  const i = (pos.y * width + pos.x) * 4;

  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

function mouseEvent(
  type: string,
  clientX: number,
  clientY: number
): MouseEvent {
  return new MouseEvent(type, { button: 0, buttons: 1, clientX, clientY, bubbles: true });
}

describe("CanvasManager — select mode", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  // 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
  // client 84 + n*4 -> texture n, exactly (chosen to land on pixel starts,
  // no floor-rounding ambiguity).

  function makeManager(options: CanvasManagerOptions = {}): CanvasManager {
    return new CanvasManager(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      zoom: { default: 4 },
      ...options
    });
  }

  function deleteKey(): KeyboardEvent {
    return new KeyboardEvent("keydown", { key: "Delete", code: "Delete", bubbles: true, cancelable: true });
  }

  function ctrlKey(key: string): KeyboardEvent {
    return new KeyboardEvent("keydown", {
      key, code: `Key${key.toUpperCase()}`, ctrlKey: true, bubbles: true, cancelable: true
    });
  }

  test("dragging out a rectangle then Delete replaces it with the erase color (default opaque white)", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "sanity: painted black before delete"
    );

    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255]);
    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 3 }, 8), [255, 255, 255, 255]);
    manager.destroy();
  });

  test("select.eraseColor overrides the default erase color", () => {
    const manager = makeManager({ select: { eraseColor: "#FF00FF" } });
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 0, 255, 255]);
    manager.destroy();
  });

  test("dragging a real (non-pasted) selection previews the source as vacated mid-drag", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));

    // Mid-drag, before mouseup. MockCanvas2DContext.fillRect ignores canvas
    // transforms, so the floating overlay's source-blank paints directly
    // at raw pixel (sourceRect.x, sourceRect.y) on the interactive canvas.
    const midDragPixels = (canvas as unknown as MockCanvasElement)._pixels;
    assert.deepStrictEqual(
      readPixel(midDragPixels, { x: 2, y: 2 }, canvas.width),
      [255, 255, 255, 255],
      "source previewed as vacated (erase color) while a real move is in progress"
    );

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    manager.destroy();
  });

  test("dragging a just-pasted duplicate does NOT preview the original as vacated (regression)", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();
    const mockCanvas = canvas as unknown as MockCanvasElement;

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(ctrlKey("c"));
    window.dispatchEvent(ctrlKey("v"));

    // Baseline: whatever the render canvas shows at (2,2) right after the
    // paste (background/checkerboard fill — the mock's drawImage is a
    // no-op, so the actual texture content isn't reflected here either
    // way; what matters is whether the erase-color blank gets applied on
    // top of it during the drag).
    const baseline = readPixel(mockCanvas._pixels, { x: 2, y: 2 }, canvas.width);

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));

    // Mid-drag: the original must stay visually intact — no erase-color
    // flash where the real content still lives (previously it briefly
    // "disappeared", only to reappear on drop once the commit-level fix
    // skipped the actual erase).
    const midDrag = readPixel(mockCanvas._pixels, { x: 2, y: 2 }, canvas.width);
    assert.deepStrictEqual(midDrag, baseline, "unchanged from before the drag — nothing is actually being vacated");
    assert.notDeepStrictEqual(midDrag, [255, 255, 255, 255], "must not show the erase color");

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    manager.destroy();
  });

  test("dragging the selection moves it: source is erased, destination gets the moved pixels", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
    manager.setMode("select");

    // Create the selection over (2,2)-(3,3).
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Drag it by (+2, +2), landing on (4,4)-(5,5).
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255], "source vacated");
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "destination got the moved pixel"
    );
    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 5, y: 5 }, 8), [0, 0, 0, 255]);
    manager.destroy();
  });

  test("a click-only drag (no movement) commits nothing — the selection just stays put", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // mousedown-then-immediately-mouseup inside the (unmoved) selection
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "untouched — nothing to commit");
    manager.destroy();
  });

  test("Ctrl+C then Ctrl+V duplicates in place; moving the duplicate away leaves the original untouched", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(ctrlKey("c"));
    window.dispatchEvent(ctrlKey("v"));

    // The pasted copy landed exactly on the original position (invisible
    // until moved) and is now the active selection — dragging it away
    // must relocate only the *duplicate*, leaving the original in place.
    // (Regression: a naive move erases its source unconditionally, which
    // would wipe out the original here since source === original spot.)
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "original survives the duplicate's first move"
    );
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "duplicate landed at destination"
    );
    manager.destroy();
  });

  test("moving an already-relocated duplicate a second time erases its (now real) previous spot", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(ctrlKey("c"));
    window.dispatchEvent(ctrlKey("v"));

    // First move: relocates the duplicate to (4,4), original at (2,2) survives.
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Second move: the duplicate now legitimately owns (4,4) — moving it
    // again to (6,6) must erase (4,4) for real this time.
    canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));
    canvas.dispatchEvent(mouseEvent("mousemove", 108, 108));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "original still untouched");
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 4, y: 4 }, 8),
      [255, 255, 255, 255],
      "second move erases the duplicate's now-real previous spot"
    );
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 6, y: 6 }, 8),
      [0, 0, 0, 255],
      "duplicate landed at the new destination"
    );
    manager.destroy();
  });

  test("Ctrl+V without a prior Ctrl+C is a no-op", () => {
    const manager = makeManager();
    const before = manager.getTexture().slice();

    window.dispatchEvent(ctrlKey("v"));

    assert.deepStrictEqual(manager.getTexture(), before);
    manager.destroy();
  });

  test("clicking outside the current selection discards it and starts a new one", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Click far outside the first (1x1) selection: starts a fresh one at (6,6).
    canvas.dispatchEvent(mouseEvent("mousedown", 108, 108));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "old selection untouched");
    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 6, y: 6 }, 8), [255, 255, 255, 255], "new selection erased");
    manager.destroy();
  });

  test("switching mode away from 'select' clears the active selection", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    manager.setMode("paint");
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "cleared by the mode switch — Delete is a no-op"
    );
    manager.destroy();
  });

  test("dragging a selection out of texture bounds clips the paint; the source is still erased", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 1, y: 1 }]);
    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.doesNotThrow(() => {
      canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
      canvas.dispatchEvent(mouseEvent("mousemove", 0, 0));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 1, y: 1 }, 8),
      [255, 255, 255, 255],
      "source erased even though destination landed out of bounds"
    );
    manager.destroy();
  });

  test("onDrawEnd fires after a select-mode commit, but onBufferUpdated (network hook) does not", () => {
    let drawEndCount = 0;
    const events: unknown[] = [];
    const manager = makeManager({
      onDrawEnd: () => {
        drawEndCount++;
      },
      onBufferUpdated: (event) => events.push(event)
    });
    const canvas = manager.getCanvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    drawEndCount = 0;
    events.length = 0;

    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    window.dispatchEvent(deleteKey());

    assert.strictEqual(drawEndCount, 1);
    assert.strictEqual(events.length, 0, "select-mode ops have no network hook (out of scope for this feature)");
    manager.destroy();
  });

  function rotateKey(): KeyboardEvent {
    return new KeyboardEvent("keydown", { key: "r", code: "KeyR", bubbles: true, cancelable: true });
  }

  function flipHorizontalKey(): KeyboardEvent {
    return new KeyboardEvent("keydown", { key: "h", code: "KeyH", bubbles: true, cancelable: true });
  }

  function flipVerticalKey(): KeyboardEvent {
    return new KeyboardEvent("keydown", { key: "v", code: "KeyV", bubbles: true, cancelable: true });
  }

  // A 2-wide x 1-tall selection over (2,2)-(3,2): black at (2,2), red at (3,2).
  function paintHorizontalPair(manager: CanvasManager): void {
    manager.brush.setColor("#000000");
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.brush.setColor("#FF0000");
    manager.commitPixels([{ x: 3, y: 2 }]);
  }

  function selectHorizontalPair(canvas: HTMLCanvasElement): void {
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }

  test("R rotates a non-square selection 90deg clockwise around its center", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    paintHorizontalPair(manager);
    manager.setMode("select");
    selectHorizontalPair(canvas);

    window.dispatchEvent(rotateKey());

    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "old footprint vacated"
    );
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 3, y: 2 }, 8),
      [0, 0, 0, 255],
      "rotated: the left pixel is now on top"
    );
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 3, y: 3 }, 8),
      [255, 0, 0, 255],
      "rotated: the right pixel is now on the bottom"
    );
    manager.destroy();
  });

  test("H flips the active selection's content left-right in place", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    paintHorizontalPair(manager);
    manager.setMode("select");
    selectHorizontalPair(canvas);

    window.dispatchEvent(flipHorizontalKey());

    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 2 }, 8),
      [255, 0, 0, 255],
      "mirrored: red is now on the left"
    );
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 3, y: 2 }, 8),
      [0, 0, 0, 255],
      "mirrored: black is now on the right"
    );
    manager.destroy();
  });

  test("V flips the active selection's content top-bottom in place", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    manager.brush.setColor("#000000");
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.brush.setColor("#FF0000");
    manager.commitPixels([{ x: 2, y: 3 }]);

    manager.setMode("select");
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    window.dispatchEvent(flipVerticalKey());

    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 2 }, 8),
      [255, 0, 0, 255],
      "mirrored: red is now on top"
    );
    assert.deepStrictEqual(
      readPixel(manager.getTexture(), { x: 2, y: 3 }, 8),
      [0, 0, 0, 255],
      "mirrored: black is now on the bottom"
    );
    manager.destroy();
  });

  test("R/H/V are no-ops without an active selection", () => {
    const manager = makeManager();
    const before = manager.getTexture().slice();

    assert.doesNotThrow(() => {
      window.dispatchEvent(rotateKey());
      window.dispatchEvent(flipHorizontalKey());
      window.dispatchEvent(flipVerticalKey());
    });

    assert.deepStrictEqual(manager.getTexture(), before);
    manager.destroy();
  });

  test("public rotate/flip methods mirror the keybinding path, and no-op safely without a selection", () => {
    const manager = makeManager();
    const canvas = manager.getCanvas();

    assert.strictEqual(manager.rotateSelection(), false, "no selection yet");
    assert.strictEqual(manager.flipSelectionHorizontal(), false);
    assert.strictEqual(manager.flipSelectionVertical(), false);

    paintHorizontalPair(manager);
    manager.setMode("select");
    selectHorizontalPair(canvas);

    assert.strictEqual(manager.flipSelectionHorizontal(), true);
    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 0, 0, 255]);
    assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [0, 0, 0, 255]);

    assert.strictEqual(manager.rotateSelection(), true);
    manager.destroy();
  });

  test("rotate/flip fire onDrawEnd but not onBufferUpdated (network hook), same as move/delete/paste", () => {
    let drawEndCount = 0;
    const events: unknown[] = [];
    const manager = makeManager({
      onDrawEnd: () => {
        drawEndCount++;
      },
      onBufferUpdated: (event) => events.push(event)
    });
    const canvas = manager.getCanvas();

    paintHorizontalPair(manager);
    drawEndCount = 0;
    events.length = 0;

    manager.setMode("select");
    selectHorizontalPair(canvas);

    window.dispatchEvent(rotateKey());
    window.dispatchEvent(flipHorizontalKey());
    window.dispatchEvent(flipVerticalKey());

    assert.strictEqual(drawEndCount, 3);
    assert.strictEqual(events.length, 0, "rotate/flip have no network hook either — Select edits stay local-only");
    manager.destroy();
  });

  describe("undo/redo", () => {
    test("undo/redo covers a Move", () => {
      const manager = makeManager({ history: { enabled: true } });
      const canvas = manager.getCanvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.setMode("select");
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 4, y: 4 }, 8), [0, 0, 0, 255]);

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "undo restores the source"
      );
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 4, y: 4 }, 8), [255, 255, 255, 255], "undo removes the destination"
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 4, y: 4 }, 8), [0, 0, 0, 255]);
      manager.destroy();
    });

    test("undo/redo covers a Delete", () => {
      const manager = makeManager({ history: { enabled: true } });
      const canvas = manager.getCanvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.setMode("select");
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      window.dispatchEvent(deleteKey());
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255]);

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "undo restores the deleted pixel"
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255], "redo re-applies the delete"
      );
      manager.destroy();
    });

    test("undo/redo covers a Paste", () => {
      const manager = makeManager({ history: { enabled: true } });
      const canvas = manager.getCanvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.setMode("select");
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      window.dispatchEvent(ctrlKey("c"));

      // Move the original away so the paste's target square is empty,
      // making the paste's undo/redo effect on that pixel observable.
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255]);

      window.dispatchEvent(ctrlKey("v"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "paste restores content at (2,2)"
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255], "undo removes the pasted content"
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "redo re-applies the paste"
      );
      manager.destroy();
    });

    test("undo/redo covers a Rotate", () => {
      const manager = makeManager({ history: { enabled: true } });
      const canvas = manager.getCanvas();

      paintHorizontalPair(manager);
      manager.setMode("select");
      selectHorizontalPair(canvas);

      window.dispatchEvent(rotateKey());
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 3, y: 3 }, 8), [255, 0, 0, 255], "sanity: rotated"
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "undo restores the pre-rotate layout"
      );
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [255, 0, 0, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 3 }, 8), [255, 255, 255, 255]);

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [0, 0, 0, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 3 }, 8), [255, 0, 0, 255]);
      manager.destroy();
    });

    test("undoing a Rotate resyncs the selection box, so a follow-up rotate doesn't corrupt pixels", () => {
      const manager = makeManager({ history: { enabled: true } });
      const canvas = manager.getCanvas();

      paintHorizontalPair(manager);
      manager.setMode("select");
      selectHorizontalPair(canvas);

      window.dispatchEvent(rotateKey());
      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "sanity: undo restored the pre-rotate layout"
      );
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [255, 0, 0, 255]);

      // If the selection box hadn't resynced to the pre-rotate rect on undo,
      // this second rotate would erase/rotate from the stale post-rotate
      // footprint instead, leaving (2,2) behind and corrupting (4,3), which
      // was never part of the selection.
      window.dispatchEvent(rotateKey());
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 255, 255, 255], "the real pre-rotate footprint got erased"
      );
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [0, 0, 0, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 3 }, 8), [255, 0, 0, 255]);
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 4, y: 3 }, 8), [255, 255, 255, 255], "unrelated pixel must stay untouched"
      );
      manager.destroy();
    });

    test("undo/redo covers a Flip", () => {
      const manager = makeManager({ history: { enabled: true } });
      const canvas = manager.getCanvas();

      paintHorizontalPair(manager);
      manager.setMode("select");
      selectHorizontalPair(canvas);

      window.dispatchEvent(flipHorizontalKey());
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 0, 0, 255], "sanity: flipped"
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [0, 0, 0, 255], "undo restores the pre-flip layout"
      );
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [255, 0, 0, 255]);

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 2, y: 2 }, 8), [255, 0, 0, 255]);
      assert.deepStrictEqual(readPixel(manager.getTexture(), { x: 3, y: 2 }, 8), [0, 0, 0, 255]);
      manager.destroy();
    });
  });
});
