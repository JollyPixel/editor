// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import { makeContainer } from "./helpers/dom.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { mockContextOf } from "./fixtures/canvas.ts";

describe("PixelArtCanvas", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  describe("onDrawEnd hook", () => {
    test("onDrawEnd option is accepted without throwing", () => {
      let callCount = 0;

      assert.doesNotThrow(() => {
        const { manager } = createPixelArtCanvas({
          onDrawEnd: () => {
            callCount++;
          }
        });
        manager.destroy();
      });

      assert.strictEqual(
        callCount,
        0,
        "hook should not fire during construction"
      );
    });
  });

  describe("zoom", () => {
    test("zoom.sensitivity returns the configured default", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        zoom: {
          default: 4,
          sensitivity: 0.25
        }
      });

      assert.strictEqual(manager.zoom.sensitivity, 0.25);
      manager.destroy();
    });

    test("setting zoom.sensitivity updates the returned value", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      manager.zoom.sensitivity = 0.5;
      assert.strictEqual(manager.zoom.sensitivity, 0.5);
      manager.destroy();
    });

    describe("default zoom fits the texture to the container", () => {
      function makeSizedContainer(
        width: number,
        height: number
      ): HTMLDivElement {
        return makeContainer(width, height).container;
      }

      test("computes a fit-to-container zoom when zoom.default is omitted", () => {
        // 200x200 container, 8x8 texture: min(200/8, 200/8) * 0.9 = 22.5 -> floor 22.
        const manager = new PixelArtCanvas(container, {
          texture: {
            maxSize: 32,
            size: { x: 8, y: 8 }
          }
        });

        assert.strictEqual(manager.zoom.value, 22);
        manager.destroy();
      });

      test("an explicit zoom.default always wins over the fit computation", () => {
        const manager = new PixelArtCanvas(container, {
          texture: {
            maxSize: 32,
            size: { x: 8, y: 8 }
          },
          zoom: { default: 4 }
        });

        assert.strictEqual(manager.zoom.value, 4);
        manager.destroy();
      });

      test("clamps the computed fit zoom to zoomMax for a tiny texture in a large container", () => {
        const manager = new PixelArtCanvas(container, {
          texture: {
            maxSize: 32,
            size: { x: 2, y: 2 }
          },
          zoom: { max: 5 }
        });

        assert.strictEqual(manager.zoom.value, 5);
        manager.destroy();
      });

      test("clamps the computed fit zoom to zoomMin for a texture much larger than the container", () => {
        const manager = new PixelArtCanvas(container, {
          texture: {
            maxSize: 2048,
            size: { x: 1000, y: 1000 }
          }
        });

        assert.strictEqual(manager.zoom.value, 1);
        manager.destroy();
      });

      test("falls back to Zoom's own default (4) when the container has no measurable size", () => {
        const zeroSizeContainer = makeSizedContainer(0, 0);
        const manager = new PixelArtCanvas(zeroSizeContainer, {
          texture: {
            maxSize: 32,
            size: { x: 8, y: 8 }
          }
        });

        assert.strictEqual(manager.zoom.value, 4);
        manager.destroy();
      });

      test("scales with a smaller container", () => {
        // 100x100 container, 8x8 texture: min(100/8, 100/8) * 0.9 = 11.25 -> floor 11.
        const smallContainer = makeSizedContainer(100, 100);
        const manager = new PixelArtCanvas(smallContainer, {
          texture: {
            maxSize: 32,
            size: { x: 8, y: 8 }
          }
        });

        assert.strictEqual(manager.zoom.value, 11);
        manager.destroy();
      });
    });
  });

  describe("backgroundColor", () => {
    test("defaults to the parent element's computed CSS background-color", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.strictEqual(
        manager.backgroundColor,
        new Color("#555555").toString()
      );
      manager.destroy();
    });

    test("backgroundColor option overrides the CSS-inferred default", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        backgroundColor: "#ff0000"
      });

      assert.strictEqual(
        manager.backgroundColor,
        new Color("#ff0000").toString()
      );
      manager.destroy();
    });

    test("setting backgroundColor updates the returned value", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      manager.backgroundColor = "#00ff00";
      assert.strictEqual(
        manager.backgroundColor,
        new Color("#00ff00").toString()
      );
      manager.destroy();
    });
  });

  describe("destroy", () => {
    test("destroy() does not throw", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });

      assert.doesNotThrow(() => manager.destroy());
    });

    test("destroy() can be called after already destroyed", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });
      manager.destroy();

      // A second call should not throw (canvas already removed from DOM)
      assert.doesNotThrow(() => manager.destroy());
    });
  });

  describe("texture setter", () => {
    test("setting texture from an HTMLCanvasElement updates texture size", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 4, y: 4 }
        }
      });
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 5;

      assert.doesNotThrow(() => {
        manager.texture = canvas;
      });
      assert.deepStrictEqual(
        manager.textureSize,
        { x: 10, y: 5 }
      );

      manager.destroy();
    });

    test("setting texture from an image-like source (no getContext) copies into new canvas", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
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
        manager.texture = mockImage as unknown as HTMLImageElement;
      });

      assert.deepStrictEqual(
        manager.textureSize,
        { x: 16, y: 16 }
      );
      manager.destroy();
    });
  });

  describe("commitPixels", () => {
    test("commits pixels as a single 'stroke' hook event", () => {
      const events: unknown[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.commitPixels([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 }
      ]);

      assert.strictEqual(events.length, 1);
      const event = events[0] as {
        action: string;
        metadata: { positions: unknown[]; };
      };
      assert.strictEqual(event.action, "stroke");
      assert.strictEqual(event.metadata.positions.length, 3);
      manager.destroy();
    });

    test("empty pixel list is a no-op", () => {
      const events: unknown[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        },
        onBufferUpdated: (event) => events.push(event)
      });

      manager.commitPixels([]);

      assert.strictEqual(events.length, 0);
      manager.destroy();
    });

    test("calls onDrawEnd once after committing", () => {
      let callCount = 0;
      const { manager } = createPixelArtCanvas({
        onDrawEnd: () => {
          callCount++;
        }
      });

      manager.commitPixels([
        { x: 1, y: 1 }
      ]);

      assert.strictEqual(callCount, 1);
      manager.destroy();
    });
  });

  describe("textureCanvas", () => {
    test("returns an HTMLCanvasElement", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });
      const canvas = manager.textureCanvas();
      assert.ok(
        canvas instanceof HTMLCanvasElement,
        "should be a canvas element"
      );
      manager.destroy();
    });
  });

  describe("canvas", () => {
    test("returns the interactive (input-listening) canvas element", () => {
      const manager = new PixelArtCanvas(container, {
        texture: {
          maxSize: 32,
          size: { x: 8, y: 8 }
        }
      });
      const canvas = manager.canvas();
      assert.ok(
        canvas instanceof HTMLCanvasElement,
        "should be a canvas element"
      );
      manager.destroy();
    });
  });

  describe("secondary color (right-click)", () => {
    // 200x200 container, 16x16 texture, zoom 4 -> centered camera (68, 68).
    // client(100,100) -> texture (8,8); client(110,100) -> texture (10,8).

    function makeManager(
      onBufferUpdated: (event: unknown) => void
    ): PixelArtCanvas {
      return createPixelArtCanvas({
        texture: { size: { x: 16, y: 16 } },
        zoom: { default: 4 },
        brush: {
          size: 1,
          maxSize: 1,
          color: "#000000",
          secondaryColor: "#00FF00"
        },
        onBufferUpdated
      }).manager;
    }

    test("right-click drag paints with the secondary color", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2,
        buttons: 2,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(events.length, 1);
      const event = events[0] as {
        action: string;
        metadata: {
          color: { r: number; g: number; b: number; a: number; };
        };
      };
      assert.strictEqual(event.action, "stroke");
      assert.deepStrictEqual(
        event.metadata.color,
        { r: 0, g: 255, b: 0, a: 255 },
        "committed color is secondary, not primary"
      );
      manager.destroy();
    });

    test("right-click in fill mode floods with the secondary color, is not tracked as a drag", () => {
      const events: unknown[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        texture: {
          size: { x: 16, y: 16 }
        },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: {
          color: "#000000",
          secondaryColor: "#00FF00"
        },
        onBufferUpdated: (event) => events.push(event)
      });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2,
        buttons: 2,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(events.length, 1, "the flood fill commits on mousedown, no drag/mouseup needed");
      const event = events[0] as {
        action: string;
        metadata: {
          color: { r: number; g: number; b: number; a: number; };
        };
      };
      assert.strictEqual(event.action, "stroke");
      assert.deepStrictEqual(
        event.metadata.color,
        { r: 0, g: 255, b: 0, a: 255 }
      );

      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          buttons: 2,
          clientX: 110,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(events.length, 1, "no secondary drag was tracked, so move/up are no-ops");
      manager.destroy();
    });

    test("Ctrl+Right-click picks the primary color from the canvas and commits no stroke", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      manager.brush.primary.set("#123456");
      manager.commitPixels([{ x: 8, y: 8 }]);
      events.length = 0;
      manager.brush.primary.set("#000000");

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2,
        buttons: 2,
        clientX: 100,
        clientY: 100,
        ctrlKey: true,
        bubbles: true
      }));

      assert.strictEqual(
        manager.brush.primary.asString("hex"),
        "#123456"
      );
      assert.strictEqual(
        events.length,
        0,
        "picking a color must not commit a stroke"
      );

      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 2,
        clientX: 110,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(
        events.length,
        0,
        "no drag was tracked for the ctrl+right-click pick"
      );
      manager.destroy();
    });

    test("a primary stroke in progress blocks a secondary stroke from starting", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      canvas.dispatchEvent(
        new MouseEvent("mousedown", {
          button: 0,
          buttons: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mousedown", {
          button: 2,
          buttons: 3,
          clientX: 110,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(
        events.length,
        1,
        "only the primary stroke committed"
      );
      const event = events[0] as {
        metadata: {
          color: { r: number; g: number; b: number; a: number; };
        };
      };
      assert.deepStrictEqual(
        event.metadata.color,
        { r: 0, g: 0, b: 0, a: 255 },
        "committed color is primary, not secondary"
      );
      manager.destroy();
    });

    test("a secondary stroke in progress blocks a primary stroke from starting", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 2,
        buttons: 2,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 3,
        clientX: 110,
        clientY: 100,
        bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(
        events.length,
        1,
        "only the secondary stroke committed"
      );
      const event = events[0] as {
        metadata: {
          color: { r: number; g: number; b: number; a: number; };
        };
      };
      assert.deepStrictEqual(
        event.metadata.color,
        { r: 0, g: 255, b: 0, a: 255 },
        "committed color is secondary, not primary"
      );
      manager.destroy();
    });

    test("contextmenu is suppressed on the canvas", () => {
      const events: unknown[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      const event = new MouseEvent(
        "contextmenu",
        { bubbles: true, cancelable: true }
      );
      canvas.dispatchEvent(event);

      assert.ok(event.defaultPrevented);
      manager.destroy();
    });
  });

  describe("repaint (no double-paint)", () => {
    test("a committed stroke repaints exactly once", () => {
      const { manager, canvas } = createPixelArtCanvas();
      const displayCtx = mockContextOf(canvas);

      // Baseline: one drawFrame's worth of display drawImage calls.
      displayCtx.drawImageCallCount = 0;
      manager.centerTexture();
      const perFrame = displayCtx.drawImageCallCount;
      assert.ok(perFrame > 0, "centerTexture should repaint once");

      // A single buffer mutation must drive exactly one drawFrame via the
      // CanvasBuffer "changed" signal — not two (a leftover explicit call).
      displayCtx.drawImageCallCount = 0;
      manager.commitPixels([{ x: 1, y: 1 }, { x: 2, y: 2 }]);

      assert.strictEqual(
        displayCtx.drawImageCallCount,
        perFrame,
        "one committed stroke should paint exactly one frame"
      );
      manager.destroy();
    });
  });

  describe("move mode navigation", () => {
    function drag(
      canvas: HTMLCanvasElement
    ): void {
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 130,
        clientY: 120,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }

    test("a plain left-drag pans the camera in move mode", () => {
      const { manager, canvas } = createPixelArtCanvas();
      manager.onResize();
      manager.centerTexture();
      manager.mode = "move";

      const before = manager.camera;
      drag(canvas);

      assert.notDeepStrictEqual(manager.camera, before);
      manager.destroy();
    });

    test("a left-drag does not pan in paint mode", () => {
      const { manager, canvas } = createPixelArtCanvas();
      manager.onResize();
      manager.centerTexture();

      const before = manager.camera;
      drag(canvas);

      assert.deepStrictEqual(manager.camera, before);
      manager.destroy();
    });
  });
});
