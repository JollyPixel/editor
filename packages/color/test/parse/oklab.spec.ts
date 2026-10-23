// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseColor } from "../../src/parse/index.ts";
import { formatHex } from "../../src/format.ts";

// CONSTANTS
const kRedFixtures = [
  "oklch(0.627955 0.257683 29.2339)",
  "oklch(62.7955% 0.257683 29.2339)",
  "oklch(62.7955% 64.42075% 29.2339deg)",
  "OKLCH(0.627955 0.257683 0.51023rad)",
  "oklab(0.627955 0.224863 0.125846)",
  "oklab(62.7955% 56.21575% 31.4615%)"
];
const kRejected = [
  "oklch(0.5, 0.1, 30)",
  "oklab(0.5, 0.1, 0.1)",
  "oklch(0.5 0.1)",
  "oklch(0.5 0.1 30px)",
  "oklab(0.5 red 0.1)",
  "oklch(0.5 0.1 30 / 1 / 1)"
];

describe("parseColor / oklch and oklab", () => {
  for (const input of kRedFixtures) {
    test(`parses '${input}'`, () => {
      const color = parseColor(input);
      if (color === null) {
        assert.fail(`${input} did not parse`);
      }

      assert.equal(formatHex(color), "#ff0000");
    });
  }

  test("reads alpha after a slash", () => {
    assert.equal(parseColor("oklch(0.5 0.1 30 / 25%)")?.a, 0.25);
    assert.equal(parseColor("oklab(0.5 0.1 0.1 / 0.5)")?.a, 0.5);
  });

  test("treats none as zero", () => {
    assert.equal(
      formatHex(parseColor("oklch(0.5 none none)")!),
      formatHex(parseColor("oklch(0.5 0 0)")!)
    );
  });

  test("maps out of gamut values into sRGB", () => {
    const color = parseColor("oklch(0.7 0.4 150)");
    if (color === null) {
      assert.fail("did not parse");
    }

    for (const channel of [color.r, color.g, color.b]) {
      assert.ok(channel >= 0 && channel <= 1);
    }
    assert.ok(color.g > color.r && color.g > color.b);
  });

  for (const input of kRejected) {
    test(`rejects '${input}'`, () => {
      assert.equal(parseColor(input), null);
    });
  }
});
