// Import Node.js Dependencies
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

const kBrowserWindow = new Window();

let mountFocusHint:
  typeof import("../src/ui/focus/mountFocusHint.ts").mountFocusHint;

before(async() => {
  installBrowserGlobals();

  ({ mountFocusHint } = await import(
    "../src/ui/focus/mountFocusHint.ts"
  ));
});

describe("mountFocusHint", () => {
  test("mounts a hidden hint while the canvas holds focus", () => {
    const canvas = createCanvas();
    canvas.focus();

    const hint = mountFocusHint(canvas);

    try {
      const element = queryHint();
      assert.strictEqual(element.hidden, true);
      assert.strictEqual(element.style.opacity, "0");
      assert.strictEqual(element.textContent, "Click to focus");
      assert.strictEqual(element.style.pointerEvents, "none");
      assert.strictEqual(element.getAttribute("aria-hidden"), "true");
    }
    finally {
      hint.dispose();
      canvas.remove();
    }
  });

  test("reveals and places the hint once the canvas loses focus", () => {
    const canvas = createCanvas();
    canvas.focus();

    const hint = mountFocusHint(canvas);

    try {
      canvas.blur();

      const element = queryHint();
      assert.strictEqual(element.hidden, false);
      assert.strictEqual(element.style.opacity, "1");
      assert.strictEqual(element.style.position, "fixed");
      assert.strictEqual(element.style.left, "12px");
      assert.strictEqual(element.style.top, "12px");
    }
    finally {
      hint.dispose();
      canvas.remove();
    }
  });

  test("honors the text and inset options", () => {
    const canvas = createCanvas();
    const hint = mountFocusHint(canvas, {
      position: "bottom-left",
      inset: 24,
      text: "Focus me"
    });

    try {
      const element = queryHint();
      assert.strictEqual(element.textContent, "Focus me");
      assert.strictEqual(element.style.left, "24px");
      assert.strictEqual(element.style.top, "24px");
    }
    finally {
      hint.dispose();
      canvas.remove();
    }
  });

  test("removes the hint and stops reacting once disposed", () => {
    const canvas = createCanvas();
    canvas.focus();

    const hint = mountFocusHint(canvas);
    const element = queryHint();
    hint.dispose();

    assert.strictEqual(document.querySelector("body > div"), null);

    canvas.blur();
    assert.strictEqual(element.hidden, true);
    assert.strictEqual(element.isConnected, false);

    canvas.remove();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.tabIndex = -1;
  document.body.appendChild(canvas);

  return canvas;
}

function queryHint(): HTMLElement {
  const element = document.querySelector("body > div");
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
