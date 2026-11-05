// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Color } from "../src/Color.ts";
import { equalRGBA8 } from "../src/convert/bytes.ts";
import { ColorParseError } from "../src/parse/errors/ColorParseError.ts";

// CONSTANTS
const kOrange = new Color({
  r: 1,
  g: 0.4,
  b: 0,
  a: 1
});

describe("Color.parse and Color.from", () => {
  test("parse returns null for unrecognised input", () => {
    assert.equal(Color.parse("not-a-color"), null);
    assert.equal(Color.parse("#f60")?.hex(), "#ff6600");
  });

  test("from keeps a Color and copies a plain RGBA", () => {
    const plain = {
      r: 0.5,
      g: 0.25,
      b: 0,
      a: 1
    };

    assert.equal(Color.from(kOrange), kOrange);
    assert.ok(Color.from(plain) instanceof Color);
    assert.deepEqual({ ...Color.from(plain) }, plain);
  });

  test("from throws ColorParseError on unrecognised input", () => {
    assert.throws(
      () => Color.from("not-a-color"),
      (error: Error) => {
        assert.ok(error instanceof ColorParseError);
        assert.equal(error.name, "ColorParseError");
        assert.match(error.message, /not-a-color/);

        return true;
      }
    );
  });
});

describe("Color.parseDraft", () => {
  test("refuses four digit hex, a half-typed six digit value", () => {
    assert.equal(Color.parseDraft("#ff66"), null);
    assert.equal(Color.parseDraft("ff66"), null);
    assert.equal(Color.parseDraft("  #FF66  "), null);
  });

  test("accepts every other notation like parse", () => {
    assert.equal(Color.parseDraft("#f60")?.hex(), "#ff6600");
    assert.equal(Color.parseDraft("#ff660080")?.a, 128 / 255);
    assert.equal(Color.parseDraft("rgb(255 102 0)")?.hex(), "#ff6600");
    assert.equal(Color.parseDraft("not-a-color"), null);
  });
});

describe("Color bytes", () => {
  test("toBytes rounds and clamps", () => {
    assert.deepEqual(
      new Color({ r: 1.5, g: 0.5, b: -0.2, a: 1 }).toBytes(),
      { r: 255, g: 128, b: 0, a: 255 }
    );
  });

  test("fromBytes round trips every byte", () => {
    for (let value = 0; value <= 255; value++) {
      const bytes = {
        r: value,
        g: value,
        b: value,
        a: value
      };

      assert.deepEqual(Color.fromBytes(bytes).toBytes(), bytes);
    }
  });

  test("fromBytes parses a string like from", () => {
    assert.deepEqual(Color.fromBytes("#ff000080").toBytes(), { r: 255, g: 0, b: 0, a: 128 });
    assert.throws(() => Color.fromBytes("not-a-color"), ColorParseError);
  });

  test("equalRGBA8 compares every channel, alpha included", () => {
    const red = { r: 255, g: 0, b: 0, a: 255 };

    assert.equal(equalRGBA8(red, { ...red }), true);
    assert.equal(equalRGBA8(red, { ...red, a: 254 }), false);
  });

  test("byte colors print the same strings as their unit color", () => {
    const color = Color.fromBytes({ r: 255, g: 102, b: 0, a: 128 });

    assert.equal(color.hex(true), "#ff660080");
    assert.equal(color.rgb(), "rgb(255, 102, 0)");
    assert.equal(color.rgba(), "rgba(255, 102, 0, 0.502)");
  });
});

describe("Color notations", () => {
  test("hsl and oklch convert before writing", () => {
    assert.equal(kOrange.hsl(), "hsl(24, 100%, 50%)");
    assert.equal(kOrange.withAlpha(0.5).oklch(), "oklch(69.58% 0.20426 43.49 / 0.5)");
  });

  test("oklch parses back to the same byte color", () => {
    for (const hex of ["#ff6600", "#1a2b3d", "#0b0a0c", "#7fffd4", "#03fcc4"]) {
      const formatted = Color.from(hex).oklch();

      assert.equal(Color.from(formatted).hex(), hex, formatted);
    }
  });
});

describe("Color.withAlpha and Color.over", () => {
  test("withAlpha keeps the channels and replaces alpha", () => {
    assert.equal(kOrange.withAlpha(0.5).rgba(), "rgba(255, 102, 0, 0.5)");
    assert.equal(kOrange.a, 1);
  });

  test("over an opaque backdrop blends by alpha and becomes opaque", () => {
    const blended = kOrange.withAlpha(0.25).over(Color.white);

    assert.deepEqual(blended.toBytes(), { r: 255, g: 217, b: 191, a: 255 });
  });

  test("over a translucent backdrop combines both alphas", () => {
    const blended = Color.black.withAlpha(0.5).over(Color.white.withAlpha(0.5));

    assert.equal(blended.a, 0.75);
    assert.equal(blended.hex(), "#555555");
  });

  test("over a transparent backdrop keeps a transparent color transparent", () => {
    assert.equal(
      kOrange.withAlpha(0).over(Color.white.withAlpha(0)).a,
      0
    );
  });
});

describe("Color.contrastWith", () => {
  test("spans 1 to 21 between equal colors and black on white", () => {
    assert.equal(Color.black.contrastWith(Color.white), 21);
    assert.equal(Color.from("#277da1").contrastWith(Color.from("#277da1")), 1);
  });

  test("does not depend on argument order", () => {
    const gray = Color.from("#767676");

    assert.equal(gray.contrastWith(Color.white), Color.white.contrastWith(gray));
  });

  test("matches the WCAG AA threshold of mid gray on white", () => {
    assert.ok(Color.from("#767676").contrastWith(Color.white) >= 4.5);
    assert.ok(Color.from("#777777").contrastWith(Color.white) < 4.5);
  });
});

describe("Color.ink", () => {
  function ink(hex: string): string {
    return Color.from(hex).ink().hex();
  }

  test("picks the ink with the higher WCAG contrast ratio", () => {
    assert.equal(ink("#ffffff"), "#000000");
    assert.equal(ink("#000000"), "#ffffff");
    assert.equal(ink("#f9c74f"), "#000000");
    assert.equal(ink("#277da1"), "#ffffff");
  });

  test("puts black ink on saturated red and mid gray", () => {
    assert.equal(ink("#ff0000"), "#000000");
    assert.equal(ink("#808080"), "#000000");
    assert.equal(ink("#0000ff"), "#ffffff");
  });

  test("switches ink where both ratios meet", () => {
    assert.equal(ink("#767676"), "#000000");
    assert.equal(ink("#757575"), "#ffffff");
  });

  test("ignores alpha and returns an opaque ink", () => {
    assert.equal(Color.from("#ffffff00").ink(), Color.black);
  });
});
