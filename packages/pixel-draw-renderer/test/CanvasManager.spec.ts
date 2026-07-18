// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { CanvasManager } from "../src/CanvasManager.ts";
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
