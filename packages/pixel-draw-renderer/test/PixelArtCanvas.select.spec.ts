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
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import {
  canvasPixels,
  readPixel
} from "./fixtures/canvas.ts";
import { makeContainer } from "./helpers/dom.ts";
import {
  mouseEvent,
  deleteKey,
  ctrlKey
} from "./helpers/events.ts";
import {
  rotateKey,
  flipHorizontalKey,
  paintHorizontalPair,
  selectHorizontalPair
} from "./helpers/select.ts";

describe("PixelArtCanvas — select mode", () => {
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

  test("dragging out a rectangle then Delete replaces it with the dominant surrounding color (white background)", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "sanity: painted black before delete"
    );

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "sanity: painted white after delete"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 3, y: 3 }, 8),
      [255, 255, 255, 255],
      "sanity: painted white after delete"
    );
    manager.destroy();
  });

  test("Delete falls back to select.eraseColor when the vacated rect has no in-bounds neighbors", () => {
    const manager = makeManager({
      select: { eraseColor: "#FF00FF" }
    });
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 0, y: 0 }]);
    manager.mode = "select";
    // Select the whole 8x8 texture: no ring of neighbors exists outside it.
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 112, 112));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 0, y: 0 }, 8),
      [255, 0, 255, 255],
      "erase color overridden by select.eraseColor"
    );
    manager.destroy();
  });

  test("select.eraseColor overrides the default erase color", () => {
    const manager = makeManager({
      select: { eraseColor: "#FF00FF" }
    });
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 0, 255, 255],
      "erase color overridden by select.eraseColor"
    );
    manager.destroy();
  });

  test("dragging a real (non-pasted) selection previews the source as vacated mid-drag", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));

    // Mid-drag, before mouseup. MockCanvas2DContext.fillRect ignores canvas
    // transforms, so the floating overlay's source-blank paints directly
    // at raw pixel (sourceRect.x, sourceRect.y) on the interactive canvas.
    const midDragPixels = canvasPixels(canvas);
    assert.deepStrictEqual(
      readPixel(midDragPixels, { x: 2, y: 2 }, canvas.width),
      [255, 255, 255, 255],
      "source previewed as vacated (dominant surrounding color) while a real move is in progress"
    );

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    manager.destroy();
  });

  test("dragging a just-pasted duplicate does NOT preview the original as vacated (regression)", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(ctrlKey("c"));
    window.dispatchEvent(ctrlKey("v"));

    // Baseline: whatever the render canvas shows at (2,2) right after the
    // paste (background/checkerboard fill — the mock's drawImage is a
    // no-op, so the actual texture content isn't reflected here either
    // way; what matters is whether the erase-color blank gets applied on
    // top of it during the drag).
    const baseline = readPixel(
      canvasPixels(canvas),
      { x: 2, y: 2 },
      canvas.width
    );

    canvas.dispatchEvent(
      mouseEvent("mousedown", 92, 92)
    );
    canvas.dispatchEvent(
      mouseEvent("mousemove", 100, 100)
    );

    // Mid-drag: the original must stay visually intact — no erase-color
    // flash where the real content still lives (previously it briefly
    // "disappeared", only to reappear on drop once the commit-level fix
    // skipped the actual erase).
    const midDrag = readPixel(
      canvasPixels(canvas),
      { x: 2, y: 2 },
      canvas.width
    );
    assert.deepStrictEqual(
      midDrag,
      baseline,
      "unchanged from before the drag — nothing is actually being vacated"
    );
    assert.notDeepStrictEqual(
      midDrag,
      [0, 0, 0, 0],
      "must not show the erase color"
    );

    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    manager.destroy();
  });

  describe("cursor", () => {
    test("drawing a brand-new rectangle keeps the plain cursor (not a grab motion)", () => {
      const manager = makeManager();
      const canvas = manager.canvas();

      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      assert.strictEqual(canvas.style.cursor, "");

      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      assert.strictEqual(canvas.style.cursor, "");

      manager.destroy();
    });

    test("a committed selection shows a grab cursor once idle", () => {
      const manager = makeManager();
      const canvas = manager.canvas();

      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(canvas.style.cursor, "grab");
      manager.destroy();
    });

    test("dragging an existing selection switches the cursor to grabbing, and back to grab on release", () => {
      const manager = makeManager();
      const canvas = manager.canvas();

      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.strictEqual(canvas.style.cursor, "grab");

      // Second mousedown lands inside the just-created selection -> moving it.
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      assert.strictEqual(canvas.style.cursor, "grabbing");

      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.strictEqual(canvas.style.cursor, "grab");

      manager.destroy();
    });

    test("leaving select mode resets the cursor", () => {
      const manager = makeManager();
      const canvas = manager.canvas();

      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.strictEqual(canvas.style.cursor, "grab");

      manager.mode = "paint";
      assert.strictEqual(canvas.style.cursor, "");

      manager.destroy();
    });
  });

  test("dragging the selection moves it: source is erased, destination gets the moved pixels", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ]);
    manager.mode = "select";

    // Create the selection over (2,2)-(3,3).
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    // Drag it by (+2, +2), landing on (4,4)-(5,5).
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255],
      "source vacated with the dominant (white) surrounding color"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255],
      "destination got the moved pixel"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 5, y: 5 }, 8),
      [0, 0, 0, 255],
      ""
    );
    manager.destroy();
  });

  test("a plain click (no drag) does not create a selection", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    // No selection was ever established, so Delete has nothing to act on.
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "no selection — nothing erased"
    );
    manager.destroy();
  });

  test("a click-only drag (no movement) on an existing selection commits nothing — the selection just stays put", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    // mousedown-then-immediately-mouseup inside the (unmoved) selection
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "untouched — nothing to commit"
    );
    manager.destroy();
  });

  test("clicking outside the current selection discards it and starts a new one", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    // Click+drag far outside the first selection: starts a fresh one at (6,6).
    canvas.dispatchEvent(mouseEvent("mousedown", 108, 108));
    canvas.dispatchEvent(mouseEvent("mousemove", 112, 108));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "old selection untouched"
    );
    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 6, y: 6 }, 8),
      [255, 255, 255, 255],
      "new selection erased with the dominant (white) surrounding color"
    );
    manager.destroy();
  });

  test("switching mode away from 'select' clears the active selection", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.mode = "paint";
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "cleared by the mode switch — Delete is a no-op"
    );
    manager.destroy();
  });

  test("dragging a selection out of texture bounds clips the paint; the source is still erased", () => {
    const manager = makeManager();
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 1, y: 1 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 88));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.doesNotThrow(() => {
      canvas.dispatchEvent(mouseEvent("mousedown", 88, 88));
      canvas.dispatchEvent(mouseEvent("mousemove", 0, 0));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
    });

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 1, y: 1 }, 8),
      [255, 255, 255, 255],
      "source erased with the dominant (white) surrounding color even though destination landed out of bounds"
    );
    manager.destroy();
  });

  test("onDrawEnd fires after a select-mode commit, and onBufferUpdated emits a 'select-edit' network hook", () => {
    let drawEndCount = 0;
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager({
      onDrawEnd: () => {
        drawEndCount++;
      },
      onBufferUpdated: (event) => events.push(event)
    });
    const canvas = manager.canvas();

    manager.commitPixels([{ x: 2, y: 2 }]);
    drawEndCount = 0;
    events.length = 0;

    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );
    window.dispatchEvent(deleteKey());

    assert.strictEqual(drawEndCount, 1);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].action, "select-edit");
    manager.destroy();
  });

  describe("undo/redo", () => {
    test("undo/redo covers a Move", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 4 }, 8),
        [0, 0, 0, 255]
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the source"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 4 }, 8),
        [255, 255, 255, 255],
        "undo removes the destination"
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 4 }, 8),
        [0, 0, 0, 255]
      );
      manager.destroy();
    });

    test("undoing a select-edit outside select mode restores the pixels but does not reactivate the selection", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      // Leaving select mode clears the active selection.
      manager.mode = "paint";

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the source pixels regardless of mode"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 4 }, 8),
        [255, 255, 255, 255],
        "undo removes the destination pixels regardless of mode"
      );

      manager.mode = "select";
      assert.ok(
        !manager.tools.select.rotate(),
        "an undo that happened outside select mode must not resurrect the old selection once select mode is re-entered"
      );

      manager.destroy();
    });

    test("undo/redo covers a Delete", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      window.dispatchEvent(deleteKey());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255]
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the deleted pixel"
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255],
        "redo re-applies the delete"
      );
      manager.destroy();
    });

    test("undo/redo covers a Paste", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      manager.commitPixels([{ x: 2, y: 2 }]);
      manager.mode = "select";
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      window.dispatchEvent(ctrlKey("c"));

      // Move the original away so the paste's target square is empty,
      // making the paste's undo/redo effect on that pixel observable.
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255]
      );

      window.dispatchEvent(ctrlKey("v"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "paste restores content at (2,2)"
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255],
        "undo removes the pasted content"
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "redo re-applies the paste"
      );
      manager.destroy();
    });

    test("undo/redo covers a Rotate", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(canvas);

      window.dispatchEvent(rotateKey());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 0, 0, 255],
        "sanity: rotated"
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the pre-rotate layout"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 255, 255, 255]
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 0, 0, 255]
      );
      manager.destroy();
    });

    test("undoing a Rotate resyncs the selection box, so a follow-up rotate doesn't corrupt pixels", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(canvas);

      window.dispatchEvent(rotateKey());
      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "sanity: undo restored the pre-rotate layout"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [255, 0, 0, 255]
      );

      // If the selection box hadn't resynced to the pre-rotate rect on undo,
      // this second rotate would erase/rotate from the stale post-rotate
      // footprint instead, leaving (2,2) behind and corrupting (4,3), which
      // was never part of the selection.
      window.dispatchEvent(rotateKey());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 255, 255, 255],
        "the real pre-rotate footprint got erased with the dominant (white) surrounding color"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 3 }, 8),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 4, y: 3 }, 8),
        [255, 255, 255, 255],
        "unrelated pixel must stay untouched"
      );
      manager.destroy();
    });

    test("undo/redo covers a Flip", () => {
      const manager = makeManager({
        history: { enabled: true }
      });
      const canvas = manager.canvas();

      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(canvas);

      window.dispatchEvent(flipHorizontalKey());
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 0, 0, 255],
        "sanity: flipped"
      );

      window.dispatchEvent(ctrlKey("z"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [0, 0, 0, 255],
        "undo restores the pre-flip layout"
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [255, 0, 0, 255]
      );

      window.dispatchEvent(ctrlKey("y"));
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 2, y: 2 }, 8),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 3, y: 2 }, 8),
        [0, 0, 0, 255]
      );
      manager.destroy();
    });
  });
});
