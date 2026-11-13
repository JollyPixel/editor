// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clamp,
  formatBytes,
  roundTo,
  wrap
} from "#src/index.ts";

describe("clamp", () => {
  test("keeps a value inside [min, max]", () => {
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(11, 0, 10), 10);
  });
});

describe("wrap", () => {
  test("maps any value into [0, length)", () => {
    assert.equal(wrap(-1, 4), 3);
    assert.equal(wrap(-4, 4), 0);
    assert.equal(wrap(6, 4), 2);
    assert.equal(wrap(-90, 360), 270);
  });
});

describe("roundTo", () => {
  test("rounds to the given number of decimals", () => {
    assert.equal(roundTo(1.23456, 2), 1.23);
    assert.equal(roundTo(1.235, 0), 1);
    assert.equal(roundTo(0.1 + 0.2, 6), 0.3);
  });

  test("rounds ties away from zero on both signs", () => {
    assert.equal(roundTo(0.125, 2), 0.13);
    assert.equal(roundTo(-0.125, 2), -0.13);
    assert.equal(roundTo(-1.5, 0), -2);
  });

  test("never returns negative zero", () => {
    assert.ok(Object.is(roundTo(-0.0001, 2), 0));
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
