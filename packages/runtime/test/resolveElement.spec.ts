// Import Node.js Dependencies
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveElement } from "../src/resolveElement.ts";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("resolveElement", () => {
  test("returns the element as is", () => {
    const canvas = document.createElement("canvas");

    assert.strictEqual(
      resolveElement(canvas, HTMLCanvasElement),
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
      resolveElement("#game-container > canvas", HTMLCanvasElement),
      canvas
    );
  });

  test("queries the given document", () => {
    const other = document.implementation.createHTMLDocument();
    const container = other.createElement("div");
    container.id = "host";
    other.body.appendChild(container);

    assert.strictEqual(
      resolveElement("#host", HTMLElement, other),
      container
    );
  });

  test("throws when the selector matches nothing", () => {
    assert.throws(
      () => resolveElement("#missing > canvas", HTMLCanvasElement),
      {
        message: 'No element matching the selector "#missing > canvas" ' +
          "was found."
      }
    );
  });

  test("throws when the selector matches another element type", () => {
    const container = document.createElement("div");
    container.id = "game-container";
    document.body.appendChild(container);

    assert.throws(
      () => resolveElement("#game-container", HTMLCanvasElement),
      {
        name: "TypeError",
        message: 'The element matching the selector "#game-container" ' +
          "is not an HTMLCanvasElement."
      }
    );
  });

  test("throws when the element has another type", () => {
    assert.throws(
      () => resolveElement(
        document.createElement("div") as unknown as HTMLCanvasElement,
        HTMLCanvasElement
      ),
      {
        name: "TypeError",
        message: "Expected an HTMLCanvasElement or a CSS selector."
      }
    );
  });
});
