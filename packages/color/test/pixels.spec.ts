// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  imageDataToPixels,
  pixelsToImageData
} from "../src/pixels.ts";

describe("imageDataToPixels", () => {
  test("reads one pixel per four bytes", () => {
    const data = new Uint8ClampedArray([
      255, 102, 0, 255,
      0, 0, 0, 128
    ]);

    assert.deepEqual(
      imageDataToPixels(data),
      [
        { r: 255, g: 102, b: 0, a: 255 },
        { r: 0, g: 0, b: 0, a: 128 }
      ]
    );
  });

  test("copies the bytes out", () => {
    const data = new Uint8ClampedArray([255, 102, 0, 255]);
    const [pixel] = imageDataToPixels(data);

    data[0] = 0;

    assert.equal(pixel.r, 255);
  });

  test("returns an empty array for an empty buffer", () => {
    assert.deepEqual(imageDataToPixels(new Uint8ClampedArray(0)), []);
  });
});

describe("pixelsToImageData", () => {
  test("writes pixels in place", () => {
    const data = new Uint8ClampedArray(8);

    pixelsToImageData(
      [
        { r: 255, g: 102, b: 0, a: 255 },
        { r: 1, g: 2, b: 3, a: 4 }
      ],
      data
    );

    assert.deepEqual(
      [...data],
      [255, 102, 0, 255, 1, 2, 3, 4]
    );
  });

  test("a mask zeroes alpha but keeps the color channels", () => {
    const data = new Uint8ClampedArray(4);

    pixelsToImageData(
      [{ r: 255, g: 102, b: 0, a: 255 }],
      data,
      [false]
    );

    assert.deepEqual([...data], [255, 102, 0, 0]);
  });

  test("round trips through imageDataToPixels", () => {
    const pixels = [
      { r: 9, g: 8, b: 7, a: 6 },
      { r: 5, g: 4, b: 3, a: 2 }
    ];
    const data = new Uint8ClampedArray(8);

    pixelsToImageData(pixels, data);

    assert.deepEqual(imageDataToPixels(data), pixels);
  });
});
