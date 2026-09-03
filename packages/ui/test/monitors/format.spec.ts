// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  formatCount,
  formatMilliseconds,
  formatPercent,
  formatVector
} from "../../src/monitors/format.ts";

describe("monitors.formatCount", () => {
  test("rounds and groups thousands", () => {
    assert.equal(
      formatCount(1234.6),
      "1,235"
    );
  });

  test("rounds down at the half", () => {
    assert.equal(
      formatCount(0.4),
      "0"
    );
  });
});

describe("monitors.formatMilliseconds", () => {
  test("keeps one decimal and the unit", () => {
    assert.equal(
      formatMilliseconds(16.666),
      "16.7 ms"
    );
  });

  test("pads a whole number to one decimal", () => {
    assert.equal(
      formatMilliseconds(2),
      "2.0 ms"
    );
  });
});

describe("monitors.formatPercent", () => {
  test("keeps one decimal and the unit", () => {
    assert.equal(
      formatPercent(33.333),
      "33.3 %"
    );
  });
});

describe("monitors.formatVector", () => {
  test("joins only the axes the value carries", () => {
    assert.equal(
      formatVector({ x: 1, y: 2 }),
      "1, 2"
    );
    assert.equal(
      formatVector({ x: 1, y: 2, z: 3, w: 4 }),
      "1, 2, 3, 4"
    );
  });

  test("drops trailing zeros left by rounding", () => {
    assert.equal(
      formatVector({ x: 1.5, y: 2, z: 3.14159 }),
      "1.5, 2, 3.14"
    );
  });

  test("keeps the requested precision", () => {
    assert.equal(
      formatVector({ x: 3.14159, y: 0, z: 0 }, 4),
      "3.1416, 0, 0"
    );
  });
});
