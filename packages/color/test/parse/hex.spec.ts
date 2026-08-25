// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseColor } from "../../src/parse/index.ts";
import type { RGBA } from "../../src/types.ts";
import { unit } from "../helpers/channels.ts";

// CONSTANTS
const kOrange = unit(255, 102, 0);
const kFixtures: [string, RGBA][] = [
  ["#ff6600", kOrange],
  ["ff6600", kOrange],
  ["#FF6600", kOrange],
  ["  #ff6600  ", kOrange],
  ["#f60", kOrange],
  ["f60", kOrange],
  ["#ff660080", unit(255, 102, 0, 128 / 255)],
  ["#f608", unit(255, 102, 0, 136 / 255)],
  ["#00000000", unit(0, 0, 0, 0)],
  ["#ffffffff", unit(255, 255, 255, 1)]
];

describe("parseColor / hex", () => {
  for (const [input, expected] of kFixtures) {
    test(`parses '${input}'`, () => {
      assert.deepEqual(parseColor(input), expected);
    });
  }

  test("rejects lengths the grammar does not define", () => {
    for (const input of ["#f", "#ff", "#fffff", "#fffffff", "#fffffffff"]) {
      assert.equal(parseColor(input), null, input);
    }
  });

  test("rejects non-hex digits", () => {
    assert.equal(parseColor("#gg0000"), null);
    assert.equal(parseColor("#ff-660"), null);
  });
});
