// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  formatHex,
  formatHex8,
  formatHsl,
  formatOklch,
  formatRgb,
  formatRgb8,
  formatRgba,
  formatRgba8
} from "../src/format.ts";
import { parseColor } from "../src/parse/index.ts";
import { ColorSpace } from "../src/convert/index.ts";

// CONSTANTS
const kOrange = {
  r: 1,
  g: 0.4,
  b: 0,
  a: 1
};
const kTranslucent = {
  r: 1,
  g: 0.4,
  b: 0,
  a: 0.5
};

describe("formatHex", () => {
  test("writes lowercase six digit hex by default", () => {
    assert.equal(formatHex(kOrange), "#ff6600");
  });

  test("pads single digit channels", () => {
    assert.equal(
      formatHex({ r: 0, g: 1 / 255, b: 2 / 255, a: 1 }),
      "#000102"
    );
  });

  test("appends alpha only when asked", () => {
    assert.equal(formatHex(kTranslucent), "#ff6600");
    assert.equal(formatHex(kTranslucent, true), "#ff660080");
  });

  test("clamps and rounds out-of-range channels", () => {
    assert.equal(
      formatHex({ r: 1.5, g: -0.2, b: 0.5, a: 1 }),
      "#ff0080"
    );
  });

  test("formatHex8 reads byte channels", () => {
    assert.equal(
      formatHex8({ r: 255, g: 102, b: 0, a: 128 }, true),
      "#ff660080"
    );
  });
});

describe("formatRgb and formatRgba", () => {
  test("writes the legacy comma form", () => {
    assert.equal(formatRgb(kOrange), "rgb(255, 102, 0)");
    assert.equal(formatRgba(kTranslucent), "rgba(255, 102, 0, 0.5)");
  });

  test("drops alpha from formatRgb", () => {
    assert.equal(formatRgb(kTranslucent), "rgb(255, 102, 0)");
  });

  test("keeps alpha readable rather than exact", () => {
    assert.equal(
      formatRgba({ r: 0, g: 0, b: 0, a: 1 / 3 }),
      "rgba(0, 0, 0, 0.333)"
    );
  });

  test("byte variants read RGBA8 and match the unit output", () => {
    const bytes = { r: 255, g: 102, b: 0, a: 128 };

    assert.equal(formatRgb8(bytes), "rgb(255, 102, 0)");
    assert.equal(formatRgba8(bytes), "rgba(255, 102, 0, 0.502)");
    assert.equal(
      formatRgba8(bytes),
      formatRgba({ ...kOrange, a: 128 / 255 })
    );
  });
});

describe("formatHsl", () => {
  test("writes percentages and drops the alpha when opaque", () => {
    assert.equal(
      formatHsl({ h: 210, s: 0.4, l: 0.17, a: 1 }),
      "hsl(210, 40%, 17%)"
    );
  });

  test("switches to hsla when translucent", () => {
    assert.equal(
      formatHsl({ h: 210, s: 0.4, l: 0.17, a: 0.5 }),
      "hsla(210, 40%, 17%, 0.5)"
    );
  });

  test("wraps the hue", () => {
    assert.equal(
      formatHsl({ h: -150, s: 0.4, l: 0.17, a: 1 }),
      "hsl(210, 40%, 17%)"
    );
  });
});

describe("formatOklch", () => {
  test("writes lightness as a percentage and drops the alpha when opaque", () => {
    assert.equal(
      formatOklch({ l: 0.627955, c: 0.257683, h: 29.2339, a: 1 }),
      "oklch(62.8% 0.2577 29.23)"
    );
  });

  test("appends a slash alpha when translucent and wraps the hue", () => {
    assert.equal(
      formatOklch({ l: 0.5, c: 0.1, h: -30, a: 0.5 }),
      "oklch(50% 0.1 330 / 0.5)"
    );
  });

  test("parses back to the same byte color", () => {
    for (const hex of ["#ff6600", "#1a2b3d", "#0b0a0c", "#7fffd4"]) {
      const color = parseColor(hex)!;
      const formatted = formatOklch(ColorSpace.oklch.fromRgb(color));

      assert.equal(formatHex(parseColor(formatted)!), hex, formatted);
    }
  });
});
