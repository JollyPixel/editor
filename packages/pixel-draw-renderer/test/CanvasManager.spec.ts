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
});
