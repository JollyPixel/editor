// Import Node.js Dependencies
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import type {
  OverlayLayer as OverlayLayerType
} from "../../../src/ui/overlay/OverlayLayer.ts";

// CONSTANTS
const kBrowserWindow = new Window();

let mountFocusHint:
  typeof import("../../../src/ui/focus/mountFocusHint.ts").mountFocusHint;
let OverlayLayer:
  typeof import("../../../src/ui/overlay/OverlayLayer.ts").OverlayLayer;

before(async() => {
  installBrowserGlobals();

  ({ mountFocusHint } = await import(
    "../../../src/ui/focus/mountFocusHint.ts"
  ));
  ({ OverlayLayer } = await import(
    "../../../src/ui/overlay/OverlayLayer.ts"
  ));
});

describe("mountFocusHint", () => {
  test("mounts a hidden hint while the canvas holds focus", () => {
    const { canvas, layer } = createFixture();
    canvas.focus();

    const hint = mountFocusHint(canvas, layer);

    try {
      const element = queryHint(layer);
      assert.strictEqual(element.hidden, true);
      assert.strictEqual(element.style.opacity, "0");
      assert.strictEqual(element.textContent, "Click to focus");
      assert.strictEqual(element.style.pointerEvents, "none");
      assert.strictEqual(element.style.zIndex, "");
      assert.strictEqual(element.getAttribute("aria-hidden"), "true");
    }
    finally {
      hint.dispose();
      disposeFixture(canvas, layer);
    }
  });

  test("reveals the hint once the canvas loses focus", () => {
    const { canvas, layer } = createFixture();
    canvas.focus();

    const hint = mountFocusHint(canvas, layer);

    try {
      canvas.blur();

      const element = queryHint(layer);
      assert.strictEqual(element.hidden, false);
      assert.strictEqual(element.style.opacity, "1");
    }
    finally {
      hint.dispose();
      disposeFixture(canvas, layer);
    }
  });

  test("anchors the hint at the top center by default", () => {
    const { canvas, layer } = createFixture();
    const hint = mountFocusHint(canvas, layer);

    try {
      const slot = queryHint(layer).parentElement;
      assert.ok(slot);
      assert.strictEqual(slot.style.top, "12px");
      assert.strictEqual(slot.style.left, "50%");
      assert.strictEqual(slot.style.pointerEvents, "none");
    }
    finally {
      hint.dispose();
      disposeFixture(canvas, layer);
    }
  });

  test("honors the position, text and inset options", () => {
    const { canvas, layer } = createFixture();
    const hint = mountFocusHint(canvas, layer, {
      position: "bottom-left",
      inset: 24,
      text: "Focus me"
    });

    try {
      const element = queryHint(layer);
      const slot = element.parentElement;
      assert.ok(slot);
      assert.strictEqual(element.textContent, "Focus me");
      assert.strictEqual(slot.style.left, "24px");
      assert.strictEqual(slot.style.bottom, "24px");
    }
    finally {
      hint.dispose();
      disposeFixture(canvas, layer);
    }
  });

  test("removes the hint and stops reacting once disposed", () => {
    const { canvas, layer } = createFixture();
    canvas.focus();

    const hint = mountFocusHint(canvas, layer);
    const element = queryHint(layer);
    hint.dispose();

    assert.strictEqual(layer.element.childElementCount, 0);

    canvas.blur();
    assert.strictEqual(element.hidden, true);
    assert.strictEqual(element.isConnected, false);

    disposeFixture(canvas, layer);
  });
});

function createFixture(): {
  canvas: HTMLCanvasElement;
  layer: OverlayLayerType;
} {
  const canvas = document.createElement("canvas");
  canvas.tabIndex = -1;
  document.body.appendChild(canvas);

  return {
    canvas,
    layer: new OverlayLayer(canvas)
  };
}

function disposeFixture(
  canvas: HTMLCanvasElement,
  layer: OverlayLayerType
): void {
  layer.dispose();
  canvas.remove();
}

function queryHint(
  layer: OverlayLayerType
): HTMLElement {
  const element = layer.element.querySelector("[aria-hidden]");
  assert.ok(element instanceof HTMLElement);

  return element;
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
      value: kBrowserWindow.ResizeObserver
    }
  });
}
