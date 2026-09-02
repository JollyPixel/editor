// Import Node.js Dependencies
import { before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

const kBrowserWindow = new Window();

let resolveRuntimeCanvasFn:
  typeof import("../src/resolveRuntimeCanvas.ts").resolveRuntimeCanvas;

before(async() => {
  installBrowserGlobals();

  ({ resolveRuntimeCanvas: resolveRuntimeCanvasFn } = await import(
    "../src/resolveRuntimeCanvas.ts"
  ));
});

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("resolveRuntimeCanvas", () => {
  test("returns the canvas element as is", () => {
    const canvas = document.createElement("canvas");

    assert.strictEqual(
      resolveRuntimeCanvasFn(canvas),
      canvas
    );
  });

  test("queries the document when given a selector", () => {
    const container = document.createElement("div");
    container.id = "game-container";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    document.body.appendChild(container);

    assert.strictEqual(
      resolveRuntimeCanvasFn("#game-container > canvas"),
      canvas
    );
  });

  test("throws when the selector matches nothing", () => {
    assert.throws(
      () => resolveRuntimeCanvasFn("#missing > canvas"),
      {
        message: 'No element matching the selector "#missing > canvas" ' +
          "was found."
      }
    );
  });

  test("throws when the selector matches a non canvas element", () => {
    const container = document.createElement("div");
    container.id = "game-container";
    document.body.appendChild(container);

    assert.throws(
      () => resolveRuntimeCanvasFn("#game-container"),
      {
        message: 'The element matching the selector "#game-container" ' +
          "is not an HTMLCanvasElement."
      }
    );
  });

  test("throws when the element is not a canvas", () => {
    assert.throws(
      () => resolveRuntimeCanvasFn(
        document.createElement("div") as unknown as HTMLCanvasElement
      ),
      {
        message: "An HTMLCanvasElement or a CSS selector is required to " +
          "create a Runtime instance."
      }
    );
  });
});

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
    HTMLCanvasElement: {
      configurable: true,
      value: kBrowserWindow.HTMLCanvasElement
    }
  });
}
