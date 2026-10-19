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
  decodeHeights,
  encodeHeights
} from "#src/index.ts";

describe("height codec", () => {
  test("round-trips Float32 heights bit for bit", () => {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights[0] = HEIGHT_RANGE.min;
    heights[1] = HEIGHT_RANGE.max;
    heights[2] = -0.1;
    heights[CHUNK_SAMPLE_COUNT - 1] = 1234.5678;

    assert.deepEqual(decodeHeights(encodeHeights(heights)), heights);
  });

  test("stores heights little-endian", () => {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights[0] = 1;
    const bytes = Uint8Array.from(atob(encodeHeights(heights)), (char) => char.charCodeAt(0));

    assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x00, 0x80, 0x3f]);
  });

  test("refuses a payload of the wrong size, out of range or not base64", () => {
    const outOfRange = new Float32Array(CHUNK_SAMPLE_COUNT);
    outOfRange[7] = HEIGHT_RANGE.max * 2;

    assert.equal(decodeHeights(encodeHeights(new Float32Array(16))), null);
    assert.equal(decodeHeights(encodeHeights(outOfRange)), null);
    assert.equal(decodeHeights("%%%"), null);
  });
});
