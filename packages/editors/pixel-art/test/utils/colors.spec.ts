// Import Node.js Dependencies
import assert from "node:assert";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { Color } from "vanilla-picker";

// Import Internal Dependencies
import {
  fromPickerColor,
  toRgbaHex,
  toRgbaString
} from "../../src/utils/colors.ts";

function createPickerColor(
  hex: string,
  alpha: number
): Color {
  return {
    hex,
    rgba: [0, 0, 0, alpha],
    hsla: [0, 0, 0, alpha],
    rgbString: "",
    rgbaString: "",
    hslString: "",
    hslaString: ""
  };
}

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

describe("fromPickerColor", () => {
  it("should strip the alpha suffix from an 8-digit picker hex", () => {
    const result = fromPickerColor(createPickerColor("#1a2b3cff", 1));

    assert.strictEqual(result.hex, "#1a2b3c");
  });

  it("should read opacity from the rgba alpha channel", () => {
    const result = fromPickerColor(createPickerColor("#00000080", 0.5));

    assert.strictEqual(result.opacity, 0.5);
  });
});
