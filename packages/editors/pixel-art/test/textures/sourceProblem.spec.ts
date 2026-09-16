// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sourceProblem } from "../../src/textures/textures.ts";

function source(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas as unknown as HTMLCanvasElement;
}

describe("sourceProblem", () => {
  test("accepts an image within the maximum size", () => {
    assert.equal(sourceProblem(source(64, 32), 64), null);
  });

  test("rejects an empty image", () => {
    assert.equal(sourceProblem(source(0, 16), 64), "Could not decode the image");
  });

  test("rejects an image larger than the maximum size on either axis", () => {
    const message = "Image exceeds the maximum texture size of 64×64";

    assert.equal(sourceProblem(source(65, 16), 64), message);
    assert.equal(sourceProblem(source(16, 65), 64), message);
  });
});
