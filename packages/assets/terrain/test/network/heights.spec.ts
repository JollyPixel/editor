// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  HEIGHT_RANGE
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  decodeHeightBytes,
  encodeHeightBytes
} from "#src/index.ts";

describe("height codec", () => {
  test("round-trips Float32 heights bit for bit", () => {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights[0] = HEIGHT_RANGE.min;
    heights[1] = HEIGHT_RANGE.max;
    heights[2] = -0.1;
    heights[CHUNK_SAMPLE_COUNT - 1] = 1234.5678;

    assert.deepEqual(decodeHeightBytes(encodeHeightBytes(heights)), heights);
  });

  test("stores heights little-endian", () => {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights[0] = 1;
    const bytes = encodeHeightBytes(heights);

    assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x00, 0x80, 0x3f]);
  });

  test("refuses a payload of the wrong size or out of range", () => {
    const outOfRange = new Float32Array(CHUNK_SAMPLE_COUNT);
    outOfRange[7] = HEIGHT_RANGE.max * 2;

    assert.equal(decodeHeightBytes(encodeHeightBytes(new Float32Array(16))), null);
    assert.equal(decodeHeightBytes(encodeHeightBytes(outOfRange)), null);
  });
});
