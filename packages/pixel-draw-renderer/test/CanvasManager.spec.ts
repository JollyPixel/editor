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

function shiftKeyDown(repeat = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Shift", bubbles: true, repeat });
}

function shiftKeyUp(): KeyboardEvent {
  return new KeyboardEvent("keyup", { key: "Shift", bubbles: true });
}

function moveTo(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY, bubbles: true }));
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

describe("CanvasManager", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("onDrawEnd hook", () => {
    test("onDrawEnd option is accepted without throwing", () => {
      let callCount = 0;

      assert.doesNotThrow(() => {
        const manager = new CanvasManager(container, {
          texture: { maxSize: 32, size: { x: 8, y: 8 } },
          onDrawEnd: () => {
            callCount++;
          }
        });
        manager.destroy();
      });

      assert.strictEqual(callCount, 0, "hook should not fire during construction");
    });
  });

  describe("zoom sensitivity", () => {
    test("getZoomSensitivity returns the configured default", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        zoom: { default: 4, sensitivity: 0.25 }
      });

      assert.strictEqual(manager.getZoomSensitivity(), 0.25);
      manager.destroy();
    });

    test("setZoomSensitivity updates the value returned by getZoomSensitivity", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });

      manager.setZoomSensitivity(0.5);
      assert.strictEqual(manager.getZoomSensitivity(), 0.5);
      manager.destroy();
    });
  });

  describe("destroy", () => {
    test("destroy() does not throw", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });

      assert.doesNotThrow(() => manager.destroy());
    });

    test("destroy() can be called after already destroyed", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });
      manager.destroy();

      // A second call should not throw (canvas already removed from DOM)
      assert.doesNotThrow(() => manager.destroy());
    });
  });

  describe("setTexture", () => {
    test("setTexture with HTMLCanvasElement updates texture size", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 4, y: 4 } }
      });
      const canvas = kEmulatedBrowserWindow.document.createElement("canvas") as unknown as HTMLCanvasElement;
      canvas.width = 10;
      canvas.height = 5;

      assert.doesNotThrow(() => manager.setTexture(canvas));
      assert.deepStrictEqual(manager.getTextureSize(), { x: 10, y: 5 });

      manager.destroy();
    });

    test("setTexture with image-like source (no getContext) copies into new canvas", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });

      // Simulate an HTMLImageElement: has width/naturalWidth but NO getContext method
      const mockImage = {
        naturalWidth: 16,
        naturalHeight: 16,
        width: 16,
        height: 16
        // deliberately no getContext property — duck-typing detects this as an image
      };

      assert.doesNotThrow(() => {
        manager.setTexture(mockImage as unknown as HTMLImageElement);
      });

      assert.deepStrictEqual(manager.getTextureSize(), { x: 16, y: 16 });
      manager.destroy();
    });
  });

  describe("commitPixels", () => {
    test("commits pixels as a single 'stroke' hook event", () => {
      const events: unknown[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.commitPixels([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);

      assert.strictEqual(events.length, 1);
      const event = events[0] as { action: string; metadata: { positions: unknown[]; }; };
      assert.strictEqual(event.action, "stroke");
      assert.strictEqual(event.metadata.positions.length, 3);
      manager.destroy();
    });

    test("empty pixel list is a no-op", () => {
      const events: unknown[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.commitPixels([]);

      assert.strictEqual(events.length, 0);
      manager.destroy();
    });

    test("calls onDrawEnd once after committing", () => {
      let callCount = 0;
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        onDrawEnd: () => {
          callCount++;
        }
      });

      manager.commitPixels([{ x: 1, y: 1 }]);

      assert.strictEqual(callCount, 1);
      manager.destroy();
    });
  });

  describe("getTextureCanvas", () => {
    test("returns an HTMLCanvasElement", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });
      const canvas = manager.getTextureCanvas();
      assert.ok(canvas instanceof MockCanvasElement, "should be a canvas-like element");
      manager.destroy();
    });
  });

  describe("getCanvas", () => {
    test("returns the interactive (input-listening) canvas element", () => {
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } }
      });
      const canvas = manager.getCanvas();
      assert.ok(canvas instanceof MockCanvasElement, "should be a canvas-like element");
      manager.destroy();
    });
  });

  describe("line tool (Shift)", () => {
    // 200x200 container, 16x16 texture, zoom 4 -> centered camera (68, 68).
    // client(100,100) -> texture (8,8); client(128,100) -> texture (15,8).

    function makeManager(onBufferUpdated: (event: unknown) => void): CanvasManager {
      return new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        brush: { size: 1, maxSize: 1 },
        onBufferUpdated
      });
    }

    test("Shift-arm-then-mousedown commits a brush-stamped line as a single stroke", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      moveTo(canvas, 128, 100);

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 1);
      const event = events[0] as { action: string; metadata: { positions: unknown[]; }; };
      assert.strictEqual(event.action, "stroke");
      assert.strictEqual(event.metadata.positions.length, 8, "1px brush over an 8px-long horizontal line");
      manager.destroy();
    });

    test("Shift then mousedown with no movement paints a single pixel (zero-length fallback)", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 1);
      const event = events[0] as { metadata: { positions: unknown[]; }; };
      assert.strictEqual(event.metadata.positions.length, 1);
      manager.destroy();
    });

    test("committing via mousedown does not chain into a freehand stroke while still held", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      moveTo(canvas, 128, 100);

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 140, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 1, "no chained freehand stroke after the line commit");
      manager.destroy();
    });

    test("holding Shift through a commit re-arms the line from the committed endpoint (chained polyline)", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      moveTo(canvas, 128, 100);

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 1, "first segment committed");

      // Shift is still held (no keyup dispatched): moving and clicking again
      // should chain a second segment starting where the first one ended,
      // without requiring the user to release and re-press Shift.
      moveTo(canvas, 128, 128);
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 128, bubbles: true
      }));

      assert.strictEqual(events.length, 2, "second segment chained without re-pressing Shift");
      const secondEvent = events[1] as { metadata: { positions: unknown[]; }; };
      assert.strictEqual(secondEvent.metadata.positions.length, 8, "vertical 8px segment from the first segment's endpoint");
      manager.destroy();
    });

    test("releasing Shift after a commit does not re-arm the line tool", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      moveTo(canvas, 128, 100);

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
      }));
      window.dispatchEvent(shiftKeyUp());

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 128, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 140, clientY: 128, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 2, "first is the committed line, second is a normal freehand stroke");
      const freehandEvent = events[1] as { metadata: { positions: unknown[]; }; };
      assert.notStrictEqual(freehandEvent.metadata.positions.length, 8, "not a rasterized 8px line — a freehand stroke instead");
      manager.destroy();
    });

    test("Shift pressed mid-stroke commits the in-progress stroke, then commits the line on mouseup", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 110, clientY: 100, bubbles: true
      }));

      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(events.length, 1, "the in-progress freehand stroke was committed when Shift armed the line");

      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 2, "releasing the mouse commits the armed line as a second stroke");
      manager.destroy();
    });

    test("Shift keyup without mousedown cancels the line — nothing committed", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      window.dispatchEvent(shiftKeyUp());

      assert.strictEqual(events.length, 0);
      manager.destroy();
    });

    test("setMode away from 'paint' cancels an armed line", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      manager.setMode("move");

      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 0, "the cancelled line must not commit on the next mouseup");
      manager.destroy();
    });

    test("window blur cancels an armed line", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      window.dispatchEvent(new Event("blur"));

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 1, "after blur cancels the line, mousedown behaves as a normal freehand stroke");
      manager.destroy();
    });

    test("OS key-repeat keydown does not reset the armed startPosition", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.getCanvas();

      moveTo(canvas, 100, 100);
      window.dispatchEvent(shiftKeyDown());
      moveTo(canvas, 128, 100);
      window.dispatchEvent(shiftKeyDown(true));

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
      }));

      const event = events[0] as { metadata: { positions: unknown[]; }; };
      assert.strictEqual(event.metadata.positions.length, 8, "start should still be (8,8), not reset by the repeat event");
      manager.destroy();
    });
  });

  describe("select mode", () => {
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
      return new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true });
    }

    function ctrlKey(key: string): KeyboardEvent {
      return new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
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
  });

  describe("fill mode", () => {
    // 200x200 container, 16x16 texture, zoom 4 -> centered camera (68, 68).
    // client(100,100) -> texture (8,8).

    test("click flood-fills the connected region as a single stroke", () => {
      const events: unknown[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        onBufferUpdated: (event) => events.push(event)
      });
      const canvas = manager.getCanvas();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 1);
      const event = events[0] as { action: string; metadata: { positions: unknown[]; }; };
      assert.strictEqual(event.action, "stroke");
      // Whole 16x16 texture is uniformly white by default except (0,0),
      // which PixelBuffer always initializes fully transparent.
      assert.strictEqual(event.metadata.positions.length, 16 * 16 - 1);
      manager.destroy();
    });

    test("click does not arm a freehand drag stroke afterwards", () => {
      const events: unknown[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        onBufferUpdated: (event) => events.push(event)
      });
      const canvas = manager.getCanvas();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 110, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.length, 1, "only the single fill click commits — no chained freehand stroke");
      manager.destroy();
    });

    test("clicking a region already matching the brush color is a no-op", () => {
      const events: unknown[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FFFFFF" },
        onBufferUpdated: (event) => events.push(event)
      });
      const canvas = manager.getCanvas();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 0, "fill color already matches the target region's color");
      manager.destroy();
    });

    test("a second click after the first fill is also a no-op (region now matches fill color)", () => {
      const events: unknown[] = [];
      const manager = new CanvasManager(container, {
        texture: { maxSize: 32, size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        onBufferUpdated: (event) => events.push(event)
      });
      const canvas = manager.getCanvas();

      function click(): void {
        canvas.dispatchEvent(new MouseEvent("mousedown", {
          button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
        }));
      }

      click();
      click();

      assert.strictEqual(events.length, 1, "second click on the now-red region is a no-op");
      manager.destroy();
    });
  });
});
