// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureSource } from "../../../src/textures/import/TextureSource.ts";
import {
  TextureImportError
} from "../../../src/textures/import/errors/TextureImportError.ts";

function createCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function createSource(
  width: number,
  height: number
): TextureSource {
  return new TextureSource({
    canvas: createCanvas(width, height),
    fileName: "art/grass.png",
    maxTextureSize: 64
  });
}

describe("TextureSource", () => {
  test("accepts an image within the maximum size", () => {
    const source = createSource(64, 32);

    assert.deepEqual(source.size, { x: 64, y: 32 });
    assert.equal(source.name.value, "grass");
  });

  test("rejects an empty image", () => {
    assert.throws(() => createSource(0, 16), new TextureImportError(
      "Could not decode the image"
    ));
  });

  test("rejects an image larger than the maximum size on either axis", () => {
    const error = new TextureImportError(
      "Image exceeds the maximum texture size of 64×64"
    );

    assert.throws(() => createSource(65, 16), error);
    assert.throws(() => createSource(16, 65), error);
  });
});
