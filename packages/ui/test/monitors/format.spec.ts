// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  formatBytes,
  formatCount,
  formatDecimal,
  formatInteger,
  formatMilliseconds,
  formatPercent,
  formatVector
} from "../../src/monitors/format.ts";

describe("monitors.formatInteger", () => {
  test("rounds without grouping thousands", () => {
    assert.equal(
      formatInteger(1234.6),
      "1235"
    );
  });
});

describe("monitors.formatCount", () => {
  test("rounds and groups thousands", () => {
    assert.equal(
      formatCount(1234.6),
      "1,235"
    );
  });

  test("appends the singular unit for exactly one", () => {
    assert.equal(formatCount(1, "voxel"), "1 voxel");
  });

  test("appends the plural unit otherwise", () => {
    assert.equal(formatCount(0, "voxel"), "0 voxels");
    assert.equal(formatCount(12345, "voxel"), "12,345 voxels");
  });

  test("honors an irregular plural", () => {
    assert.equal(formatCount(2, "person", "people"), "2 people");
  });
});

describe("monitors.formatDecimal", () => {
  test("keeps one decimal by default", () => {
    assert.equal(
      formatDecimal(1.26),
      "1.3"
    );
  });

  test("pads a whole number to one decimal", () => {
    assert.equal(
      formatDecimal(4),
      "4.0"
    );
  });

  test("honors an explicit decimals count", () => {
    assert.equal(
      formatDecimal(1.2345, 3),
      "1.234"
    );
    assert.equal(
      formatDecimal(1.5, 0),
      "2"
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

describe("monitors.formatBytes", () => {
  test("keeps whole bytes below one kibibyte", () => {
    assert.equal(
      formatBytes(1023.4),
      "1023 B"
    );
  });

  test("steps by 1024 with one decimal", () => {
    assert.equal(
      formatBytes(1536),
      "1.5 KiB"
    );
    assert.equal(
      formatBytes(48.2 * 1024 * 1024),
      "48.2 MiB"
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
