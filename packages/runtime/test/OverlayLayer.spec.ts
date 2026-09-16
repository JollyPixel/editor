// Import Node.js Dependencies
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kBrowserWindow = new Window();
const kObservers: Array<FakeResizeObserver> = [];

class FakeResizeObserver {
  callback: () => void;
  targets: Array<Element> = [];
  disconnected = false;

  constructor(
    callback: () => void
  ) {
    this.callback = callback;
    kObservers.push(this);
  }

  observe(
    target: Element
  ): void {
    this.targets.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

let OverlayLayer:
  typeof import("../src/ui/overlay/OverlayLayer.ts").OverlayLayer;

before(async() => {
  installBrowserGlobals();

  ({ OverlayLayer } = await import(
    "../src/ui/overlay/OverlayLayer.ts"
  ));
});

describe("OverlayLayer", () => {
  test("tracks the canvas box from document.body by default", () => {
    const canvas = createCanvas();
    let rect = createRect(10, 20, 300, 200);
    canvas.getBoundingClientRect = () => rect;

    const layer = new OverlayLayer(canvas);

    try {
      assert.strictEqual(layer.element.parentElement, document.body);
      assert.strictEqual(layer.element.style.position, "fixed");
      assert.strictEqual(layer.element.style.pointerEvents, "none");
      assertBox(layer.element, "10px", "20px", "300px", "200px");

      const observer = kObservers.at(-1);
      assert.ok(observer);
      assert.deepEqual(observer.targets, [canvas]);

      rect = createRect(10, 20, 180, 200);
      observer.callback();
      assertBox(layer.element, "10px", "20px", "180px", "200px");

      rect = createRect(0, 0, 640, 480);
      window.dispatchEvent(new window.Event("resize"));
      assertBox(layer.element, "0px", "0px", "640px", "480px");
    }
    finally {
      layer.dispose();
      canvas.remove();
    }
  });

  test("fills a container element without tracking", () => {
    const container = document.createElement("div");
    const canvas = createCanvas(container);
    const observerCount = kObservers.length;

    const layer = new OverlayLayer(canvas, {
      container
    });

    try {
      assert.strictEqual(layer.element.parentElement, container);
      assert.strictEqual(layer.element.style.position, "absolute");
      assert.strictEqual(layer.element.style.top, "0px");
      assert.strictEqual(layer.element.style.right, "0px");
      assert.strictEqual(layer.element.style.bottom, "0px");
      assert.strictEqual(layer.element.style.left, "0px");
      assert.strictEqual(kObservers.length, observerCount);
    }
    finally {
      layer.dispose();
      container.remove();
    }
  });

  test("resolves a container selector", () => {
    const container = document.createElement("section");
    container.id = "viewport";
    const canvas = createCanvas(container);

    const layer = new OverlayLayer(canvas, {
      container: "#viewport"
    });

    try {
      assert.strictEqual(layer.element.parentElement, container);
    }
    finally {
      layer.dispose();
      container.remove();
    }
  });

  test("rejects a selector that matches nothing", () => {
    const canvas = createCanvas();

    try {
      assert.throws(
        () => new OverlayLayer(canvas, {
          container: "#missing"
        }),
        {
          message: "No overlay container matching the selector " +
            "\"#missing\" was found."
        }
      );
    }
    finally {
      canvas.remove();
    }
  });

  test("anchors mounted content inside a slot", () => {
    const canvas = createCanvas();
    const layer = new OverlayLayer(canvas);
    const content = document.createElement("span");

    try {
      const mounted = layer.mount(content, {
        position: "bottom-right",
        inset: 16,
        interactive: true
      });
      const slot = content.parentElement;
      assert.ok(slot);
      assert.strictEqual(slot.parentElement, layer.element);
      assert.strictEqual(slot.style.position, "absolute");
      assert.strictEqual(slot.style.right, "16px");
      assert.strictEqual(slot.style.bottom, "16px");
      assert.strictEqual(slot.style.top, "");
      assert.strictEqual(slot.style.left, "");
      assert.strictEqual(slot.style.pointerEvents, "auto");
      assert.strictEqual(slot.style.maxWidth, "calc(100% - 32px)");

      mounted.dispose();
      assert.strictEqual(slot.isConnected, false);
      assert.strictEqual(layer.element.childElementCount, 0);
    }
    finally {
      layer.dispose();
      canvas.remove();
    }
  });

  test("defaults mounted content to a passive top-left slot", () => {
    const canvas = createCanvas();
    const layer = new OverlayLayer(canvas);
    const content = document.createElement("span");

    try {
      layer.mount(content);
      const slot = content.parentElement;
      assert.ok(slot);
      assert.strictEqual(slot.style.top, "8px");
      assert.strictEqual(slot.style.left, "8px");
      assert.strictEqual(slot.style.pointerEvents, "none");
    }
    finally {
      layer.dispose();
      canvas.remove();
    }
  });

  test("stops tracking and detaches once disposed", () => {
    const canvas = createCanvas();
    let calls = 0;
    canvas.getBoundingClientRect = () => {
      calls++;

      return createRect(0, 0, 100, 100);
    };

    const layer = new OverlayLayer(canvas);
    const observer = kObservers.at(-1);
    layer.dispose();
    const callsAfterDispose = calls;

    window.dispatchEvent(new window.Event("resize"));
    window.dispatchEvent(new window.Event("scroll"));

    assert.strictEqual(layer.element.isConnected, false);
    assert.strictEqual(observer?.disconnected, true);
    assert.strictEqual(calls, callsAfterDispose);

    canvas.remove();
  });
});

function createCanvas(
  parent: HTMLElement = document.body
): HTMLCanvasElement {
  if (parent !== document.body && !parent.isConnected) {
    document.body.appendChild(parent);
  }

  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);

  return canvas;
}

function createRect(
  x: number,
  y: number,
  width: number,
  height: number
): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => null
  };
}

function assertBox(
  element: HTMLElement,
  left: string,
  top: string,
  width: string,
  height: string
): void {
  assert.deepEqual(
    {
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      height: element.style.height
    },
    {
      left,
      top,
      width,
      height
    }
  );
}

function installBrowserGlobals(): void {
  Object.defineProperties(globalThis, {
    window: {
      configurable: true,
      value: kBrowserWindow
    },
    document: {
      configurable: true,
      value: kBrowserWindow.document
    },
    HTMLElement: {
      configurable: true,
      value: kBrowserWindow.HTMLElement
    },
    Element: {
      configurable: true,
      value: kBrowserWindow.Element
    },
    ResizeObserver: {
      configurable: true,
      value: FakeResizeObserver
    }
  });
}
