// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodePng } from "@jolly-pixel/image";
import {
  IslandMap,
  NormalMap,
  NormalMapConfig
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { NormalMapPng } from "#src/normal/NormalMapPng.ts";
import { FakeFrames } from "../fixtures/frames.ts";

// CONSTANTS
const kSize = {
  x: 2,
  y: 1
};

describe("NormalMapPng", () => {
  test("keeps OpenGL pixels as stored", () => {
    const pixels = new Uint8ClampedArray([10, 200, 255, 255, 128, 0, 255, 255]);

    const png = new NormalMapPng(kSize, pixels, "opengl");

    assert.deepEqual(Array.from(png.pixels), Array.from(pixels));
    assert.notEqual(png.pixels, pixels);
  });

  test("inverts green for DirectX and leaves the source untouched", () => {
    const pixels = new Uint8ClampedArray([10, 200, 255, 255, 128, 0, 255, 255]);

    const png = new NormalMapPng(kSize, pixels, "directx");

    assert.deepEqual(
      Array.from(png.pixels),
      [10, 55, 255, 255, 128, 255, 255, 255]
    );
    assert.equal(pixels[1], 200);
  });

  test("encodes the pixels without premultiplying them", async() => {
    const pixels = new Uint8ClampedArray([10, 200, 255, 255, 128, 0, 255, 255]);

    const image = await decodePng(
      await new NormalMapPng(kSize, pixels, "opengl").encode()
    );

    assert.deepEqual([image.width, image.height], [2, 1]);
    assert.deepEqual(Array.from(image.data), Array.from(pixels));
  });

  test("capture generates a map nobody retained and releases it", (t) => {
    new FakeFrames(t);
    const pixels = new Uint8ClampedArray(kSize.x * kSize.y * 4).fill(255);
    const normals = new NormalMap({
      size: () => kSize,
      pixels: () => pixels,
      islands: () => IslandMap.fromFaces(kSize, []),
      config: () => NormalMapConfig.create(),
      connect: () => () => undefined
    });

    const png = NormalMapPng.capture(normals, "opengl");

    assert.deepEqual(png.size, kSize);
    assert.deepEqual(
      Array.from(png.pixels),
      [128, 128, 255, 255, 128, 128, 255, 255]
    );
    assert.equal(normals.retained, false);
  });
});
