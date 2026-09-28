// Import Node.js Dependencies
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveRuntimeCanvas } from "../src/resolveRuntimeCanvas.ts";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("resolveRuntimeCanvas", () => {
  test("returns the canvas element as is", () => {
    const canvas = document.createElement("canvas");

    assert.strictEqual(
      resolveRuntimeCanvas(canvas),
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
      resolveRuntimeCanvas("#game-container > canvas"),
      canvas
    );
  });

  test("throws when the selector matches nothing", () => {
    assert.throws(
      () => resolveRuntimeCanvas("#missing > canvas"),
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
      () => resolveRuntimeCanvas("#game-container"),
      {
        message: 'The element matching the selector "#game-container" ' +
          "is not an HTMLCanvasElement."
      }
    );
  });

  test("throws when the element is not a canvas", () => {
    assert.throws(
      () => resolveRuntimeCanvas(
        document.createElement("div") as unknown as HTMLCanvasElement
      ),
      {
        message: "An HTMLCanvasElement or a CSS selector is required to " +
          "create a Runtime instance."
      }
    );
  });
});
