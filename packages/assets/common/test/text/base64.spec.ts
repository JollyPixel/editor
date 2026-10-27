// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeBase64,
  encodeBase64
} from "#src/text/base64.ts";

describe("base64", () => {
  test("round-trips bytes past one encoding batch", () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 3 }, (_, index) => index % 256);

    assert.deepEqual(decodeBase64(encodeBase64(bytes)), bytes);
  });

  for (const encoded of ["AQI", "AQ I", "A=QI", "AQI*"]) {
    test(`refuses "${encoded}"`, () => {
      assert.equal(decodeBase64(encoded), null);
    });
  }
});
