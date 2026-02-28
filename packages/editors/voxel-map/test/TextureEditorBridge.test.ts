// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { TextureEditorBridge } from "../src/lib/TextureEditorBridge.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

// Minimal pixel-backed canvas mock (matches pixel-draw-renderer's needs)
class MockCanvas {
  width: number = 8;
  height: number = 8;
  style: Record<string, string> = {};
  parentElement: unknown = null;
  private _removeCalled = false;

  getContext(_type: string, _opts?: unknown) {
    return {
      imageSmoothingEnabled: false,
      fillStyle: "#000",
      fillRect: () => undefined,
      createImageData: (w: number, h: number) => {
        return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
      },
      // eslint-disable-next-line max-params
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        return {
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h
        };
      },
      putImageData: () => undefined,
      drawImage: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      rect: () => undefined,
      clip: () => undefined,
      setTransform: () => undefined
    };
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height } as DOMRect;
  }

  addEventListener(_type: string, _handler: unknown, _options?: unknown): void {
    // No-op
  }

  removeEventListener(_type: string, _handler: unknown): void {
    // No-op
  }

  dispatchEvent(_event: unknown): boolean {
    return true;
  }

  remove(): void {
    this._removeCalled = true;
    this.parentElement = null;
  }

  appendChild(_child: unknown): void {
    // No-op
  }

  toDataURL(_mime?: string): string {
    return "data:image/png;base64,FAKE";
  }

  wasRemoved(): boolean {
    return this._removeCalled;
  }
}

function installMocks(): void {
  const origCreate = (kEmulatedBrowserWindow.document as any).createElement.bind(
    kEmulatedBrowserWindow.document
  );
  (globalThis.document as any).createElement = (tag: string, opts?: unknown) => {
    if (tag.toLowerCase() === "canvas") {
      return new MockCanvas() as unknown as HTMLCanvasElement;
    }
    if (tag.toLowerCase() === "svg") {
      const el: Record<string, unknown> = {
        style: {},
        parentElement: null,
        remove() {
          this.parentElement = null;
        },
        setAttribute(_k: string, _v: string) {
          // No-op
        },
        appendChild(_c: unknown) {
          // No-op
        }
      };

      return el as unknown as Element;
    }
    const el = origCreate(tag, opts);

    return el;
  };

  // createElementNS for SVG
  (globalThis.document as any).createElementNS = (_ns: string, _tag: string) => {
    const el: Record<string, unknown> = {
      style: {},
      parentElement: null,
      remove() {
        this.parentElement = null;
      },
      setAttribute(_k: string, _v: string) {
        // No-op
      },
      appendChild(_c: unknown) {
        // No-op
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 };
      }
    };

    return el as unknown as Element;
  };
}

function makeContainer(): HTMLDivElement {
  const div = kEmulatedBrowserWindow.document.createElement("div") as unknown as HTMLDivElement;
  (div as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };
  (div as any).style = {};
  (div as any).appendChild = () => undefined;

  return div;
}

function makeVoxelRendererMock(
  tilesetId: string,
  imageWidth = 64,
  imageHeight = 32
) {
  const mockCanvas = new MockCanvas();
  mockCanvas.width = imageWidth;
  mockCanvas.height = imageHeight;

  const mockTexture = {
    image: {
      naturalWidth: imageWidth,
      naturalHeight: imageHeight,
      width: imageWidth,
      height: imageHeight
    } as HTMLImageElement,
    needsUpdate: false
  };

  return {
    tilesetManager: {
      defaultTilesetId: tilesetId,
      getTexture: (_id: string) => mockTexture,
      getDefinitions: () => [{ id: tilesetId }]
    }
  };
}

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  // @ts-expect-error
  globalThis.window = kEmulatedBrowserWindow;
  // @ts-expect-error
  globalThis.getComputedStyle = () => {
    return { backgroundColor: "#555555" };
  };
  installMocks();
});

describe("TextureEditorBridge", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  describe("isActive", () => {
    test("isActive is false before mount", () => {
      const bridge = new TextureEditorBridge();
      assert.strictEqual(bridge.isActive, false);
    });

    test("isActive is true after mount", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });
      assert.strictEqual(bridge.isActive, true);
      bridge.destroy();
    });

    test("isActive is false after destroy", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });
      bridge.destroy();
      assert.strictEqual(bridge.isActive, false);
    });
  });

  describe("loadTileset", () => {
    test("loadTileset does not throw when vr has the tileset", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });
      const vr = makeVoxelRendererMock("terrain");

      assert.doesNotThrow(() => {
        bridge.loadTileset(vr as any, "terrain");
      });

      bridge.destroy();
    });

    test("loadTileset is a no-op when bridge is not mounted", () => {
      const bridge = new TextureEditorBridge();
      const vr = makeVoxelRendererMock("terrain");

      assert.doesNotThrow(() => {
        bridge.loadTileset(vr as any, "terrain");
      });
    });

    test("loadTileset uses defaultTilesetId when tilesetId is null", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });
      const vr = makeVoxelRendererMock("default");

      assert.doesNotThrow(() => {
        bridge.loadTileset(vr as any, null);
      });

      bridge.destroy();
    });
  });

  describe("destroy", () => {
    test("destroy is idempotent — no throw on double-destroy", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });
      bridge.destroy();
      assert.doesNotThrow(() => bridge.destroy());
    });
  });

  describe("setMode / setBrushSize / setBrushColor", () => {
    test("setMode does not throw", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });

      assert.doesNotThrow(() => bridge.setMode("paint"));
      assert.doesNotThrow(() => bridge.setMode("move"));

      bridge.destroy();
    });

    test("setBrushSize does not throw", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });

      assert.doesNotThrow(() => bridge.setBrushSize(3));

      bridge.destroy();
    });

    test("setBrushColor does not throw", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });

      assert.doesNotThrow(() => bridge.setBrushColor("#ff0000"));

      bridge.destroy();
    });
  });

  describe("onResize", () => {
    test("onResize is a no-op when not mounted", () => {
      const bridge = new TextureEditorBridge();
      assert.doesNotThrow(() => bridge.onResize());
    });

    test("onResize does not throw when mounted", () => {
      const bridge = new TextureEditorBridge();
      bridge.mount(container, { texture: { maxSize: 32, size: { x: 8, y: 8 } } });

      assert.doesNotThrow(() => bridge.onResize());

      bridge.destroy();
    });
  });
});
