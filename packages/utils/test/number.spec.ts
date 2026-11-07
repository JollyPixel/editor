// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clamp,
  formatBytes
} from "#src/index.ts";

describe("clamp", () => {
  test("keeps a value inside [min, max]", () => {
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(11, 0, 10), 10);
  });
});

describe("formatBytes", () => {
  for (const [bytes, expected] of [
    [0, "0 B"],
    [1023.4, "1023 B"],
    [1536, "1.5 KiB"],
    [48.2 * 1024 * 1024, "48.2 MiB"],
    [12 * 1024 * 1024, "12 MiB"],
    [2 ** 50, "1024 TiB"]
  ] as const) {
    test(`formats ${bytes} as "${expected}"`, () => {
      assert.equal(formatBytes(bytes), expected);
    });
  }
});
