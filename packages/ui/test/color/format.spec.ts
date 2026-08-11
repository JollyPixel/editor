// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { formatHex } from "../../src/color/format.ts";
import { parseColor } from "../../src/color/parse.ts";

describe("Color.formatHex", () => {
  test("emits lowercase six digit hex by default", () => {
    assert.equal(
      formatHex({
        r: 255,
        g: 102,
        b: 0,
        a: 1
      }),
      "#ff6600"
    );
  });

  test("pads single digit channels", () => {
    assert.equal(
      formatHex({
        r: 0,
        g: 1,
        b: 15,
        a: 1
      }),
      "#00010f"
    );
  });

  test("drops alpha unless it is asked for", () => {
    const translucent = {
      r: 255,
      g: 102,
      b: 0,
      a: 0.5
    };

    assert.equal(
      formatHex(translucent),
      "#ff6600"
    );
    assert.equal(
      formatHex(translucent, true),
      "#ff660080"
    );
  });

  test("writes a fully opaque alpha pair rather than omitting it", () => {
    assert.equal(
      formatHex(
        {
          r: 0,
          g: 0,
          b: 0,
          a: 1
        },
        true
      ),
      "#000000ff"
    );
  });

  test("rounds fractional channels and clamps out of range ones", () => {
    assert.equal(
      formatHex({
        r: 254.6,
        g: -20,
        b: 300,
        a: 1
      }),
      "#ff00ff"
    );
  });

  test("round trips through parseColor", () => {
    for (const hex of ["#ff6600", "#000000", "#ffffff", "#123456"]) {
      const parsed = parseColor(hex);
      if (parsed === null) {
        assert.fail(`${hex} did not parse`);
      }

      assert.equal(
        formatHex(parsed),
        hex
      );
    }
  });

  test("round trips alpha through parseColor", () => {
    const parsed = parseColor("#ff660080");
    if (parsed === null) {
      assert.fail("the eight digit hex did not parse");
    }

    assert.equal(
      formatHex(parsed, true),
      "#ff660080"
    );
  });
});
