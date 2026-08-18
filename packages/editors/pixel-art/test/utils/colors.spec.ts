// Import Node.js Dependencies
import assert from "node:assert";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  splitRgbaHex,
  toRgbaHex,
  toRgbaString
} from "../../src/utils/colors.ts";

describe("toRgbaHex", () => {
  it("should append the opacity as a two-digit hex suffix", () => {
    assert.strictEqual(toRgbaHex("#1a2b3c", 1), "#1a2b3cff");
    assert.strictEqual(toRgbaHex("#1a2b3c", 0), "#1a2b3c00");
  });

  it("should round a fractional opacity to the nearest byte", () => {
    assert.strictEqual(toRgbaHex("#000000", 0.5), "#00000080");
  });
});

describe("toRgbaString", () => {
  it("should format a hex color and opacity as a CSS rgba() string", () => {
    assert.strictEqual(toRgbaString("#1a2b3c", 1), "rgba(26, 43, 60, 1)");
  });

  it("should pass the opacity through unrounded", () => {
    assert.strictEqual(toRgbaString("#ffffff", 0.5), "rgba(255, 255, 255, 0.5)");
  });
});

describe("splitRgbaHex", () => {
  it("should strip the alpha suffix from an 8-digit hex string", () => {
    const result = splitRgbaHex("#1a2b3cff");

    assert.strictEqual(result.hex, "#1a2b3c");
  });

  it("should read opacity from the alpha suffix", () => {
    const result = splitRgbaHex("#00000080");

    assert.strictEqual(result.opacity, 0x80 / 255);
  });

  it("should round-trip through toRgbaHex", () => {
    const hex8 = toRgbaHex("#4488ff", 0.5);
    const result = splitRgbaHex(hex8);

    assert.strictEqual(result.hex, "#4488ff");
    assert.strictEqual(result.opacity, 0x80 / 255);
  });
});
