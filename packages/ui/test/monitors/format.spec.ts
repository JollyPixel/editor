// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  formatCount,
  formatMilliseconds,
  formatPercent
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
