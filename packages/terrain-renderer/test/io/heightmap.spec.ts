// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeRaw,
  encodeRaw,
  expandHeights,
  fitGrid,
  InvalidImageError,
  measureHeights,
  parseHeightmapSidecar,
  quantizeHeights
} from "#src/index.ts";

describe("heightmap values", () => {
  test("a height range maps its ends to the first and last 16-bit values and back", () => {
    const heights = Float32Array.of(-100, 0, 300);
    const range = measureHeights(heights);
    const samples = quantizeHeights(heights, range);

    assert.deepEqual(range, { min: -100, max: 300 });
    assert.deepEqual([...samples], [0, 16384, 65535]);

    const expanded = expandHeights({ width: 3, height: 1, depth: 16, samples }, range);
    for (const [index, height] of heights.entries()) {
      assert.ok(Math.abs(expanded[index] - height) < 400 / 65535);
    }
  });

  test("flat ground writes zeros and reads back its height", () => {
    const range = { min: 7, max: 7 };
    const samples = quantizeHeights(Float32Array.of(7, 7), range);

    assert.deepEqual([...samples], [0, 0]);
    assert.deepEqual([...expandHeights({ width: 2, height: 1, depth: 16, samples }, range)], [7, 7]);
  });

  test("an 8-bit image spans the whole range too", () => {
    const samples = Uint16Array.of(0, 255);
    const image = { width: 2, height: 1, depth: 8, samples } as const;

    assert.deepEqual([...expandHeights(image, { min: 10, max: 20 })], [10, 20]);
  });
});

describe("fitGrid", () => {
  const ramp = Float32Array.of(0, 1, 2, 3);

  test("keeps a grid of the same size", () => {
    assert.deepEqual([...fitGrid(ramp, { width: 4, height: 1 }, { width: 4, height: 1 })], [...ramp]);
  });

  test("drops the closing row and column of an odd size", () => {
    const source = Float32Array.from([
      0, 1, 2,
      3, 4, 5,
      6, 7, 8
    ]);

    assert.deepEqual(
      [...fitGrid(source, { width: 3, height: 3 }, { width: 2, height: 2 })],
      [0, 1, 3, 4]
    );
  });

  test("interpolates between samples when enlarging", () => {
    assert.deepEqual(
      [...fitGrid(ramp, { width: 4, height: 1 }, { width: 8, height: 1 })],
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3]
    );
  });
});

describe("RAW codec", () => {
  test("stores 16-bit samples little-endian and reads a square back", () => {
    const samples = Uint16Array.of(0x0102, 0x0304, 0x0506, 0x0708);
    const bytes = encodeRaw({ width: 2, height: 2, depth: 16, samples });

    assert.deepEqual([...bytes.subarray(0, 2)], [0x02, 0x01]);
    assert.deepEqual(decodeRaw(bytes), { width: 2, height: 2, depth: 16, samples });
  });

  test("reads a rectangle at the size its sidecar gives", () => {
    const bytes = encodeRaw({ width: 3, height: 1, depth: 16, samples: Uint16Array.of(1, 2, 3) });

    assert.deepEqual([...decodeRaw(bytes, { width: 3, height: 1 }).samples], [1, 2, 3]);
  });

  test("refuses a size the bytes do not fill", () => {
    assert.throws(() => decodeRaw(new Uint8Array(6)), InvalidImageError);
    assert.throws(() => decodeRaw(new Uint8Array(8), { width: 3, height: 1 }), InvalidImageError);
  });
});

describe("heightmap sidecar", () => {
  const sidecar = {
    min: -4,
    max: 90,
    width: 128,
    height: 64,
    tier: 1,
    rect: { x: -1, z: 0, columns: 2, rows: 1 }
  };

  test("reads back what export writes", () => {
    assert.deepEqual(parseHeightmapSidecar(JSON.stringify(sidecar)), sidecar);
  });

  test("refuses anything else", () => {
    const refused = [
      "not json",
      "null",
      JSON.stringify({ ...sidecar, tier: 3 }),
      JSON.stringify({ ...sidecar, min: 91 }),
      JSON.stringify({ ...sidecar, width: 0 }),
      JSON.stringify({ ...sidecar, rect: { x: 0, z: 0, columns: 0, rows: 1 } })
    ];

    for (const text of refused) {
      assert.equal(parseHeightmapSidecar(text), null, text);
    }
  });
});
