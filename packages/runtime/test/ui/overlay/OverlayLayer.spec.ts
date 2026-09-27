// Import Node.js Dependencies
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

// Import Internal Dependencies
import { OverlayLayer } from "../../../src/ui/overlay/OverlayLayer.ts";

// CONSTANTS
const kObservers: Array<FakeResizeObserver> = [];

class FakeResizeObserver {
  observing = false;

  constructor() {
    kObservers.push(this);
  }

  observe(): void {
    this.observing = true;
  }

  disconnect(): void {
    this.observing = false;
  }
}

before(() => {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: FakeResizeObserver
  });
});

describe("OverlayLayer", () => {
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
    assert.strictEqual(observer?.observing, false);
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
