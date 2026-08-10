// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createCanvas2D
} from "#src/rendering/Canvas2D.ts";

describe("createCanvas2D", () => {
  test("returns a canvas with its validated 2D context", () => {
    const {
      canvas,
      context
    } = createCanvas2D(2, 3);

    assert.strictEqual(canvas.width, 2);
    assert.strictEqual(canvas.height, 3);
    assert.strictEqual(context.imageSmoothingEnabled, false);
    assert.strictEqual(context, canvas.getContext("2d"));
  });

  test("throws a descriptive error when a 2D context is unavailable", (
    testContext
  ) => {
    const createElement = document.createElement.bind(document);
    testContext.mock.method(
      document,
      "createElement",
      (tagName: string) => {
        const element = createElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          Object.assign(element, {
            getContext: () => null
          });
        }

        return element;
      }
    );

    assert.throws(
      () => createCanvas2D(1, 1),
      {
        name: "Error",
        message: "Unable to acquire a 2D canvas context"
      }
    );
  });
});
