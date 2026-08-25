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
  ["rgb(255, 102, 0)", kOrange],
  ["rgb(255 102 0)", kOrange],
  ["rgba(255, 102, 0)", kOrange],
  ["RGB(255,102,0)", kOrange],
  ["rgb(  255 ,102 , 0 )", kOrange],
  ["  rgb(255 102 0)  ", kOrange],
  ["rgb(100%, 40%, 0%)", kOrange],
  ["rgba(255, 102, 0, 0.5)", unit(255, 102, 0, 0.5)],
  ["rgb(255 102 0 / 0.5)", unit(255, 102, 0, 0.5)],
  ["rgb(255 102 0 / 50%)", unit(255, 102, 0, 0.5)],
  ["rgb(none none none)", unit(0, 0, 0)],
  ["rgb(1e2 0 0)", unit(100, 0, 0)],
  ["rgb(.5 0 0)", unit(0.5, 0, 0)]
];
const kClamped: [string, RGBA][] = [
  ["rgb(300, 0, -20)", unit(255, 0, 0)],
  ["rgb(150%, 0%, 0%)", unit(255, 0, 0)],
  ["rgba(0, 0, 0, 2)", unit(0, 0, 0, 1)],
  ["rgba(0, 0, 0, -1)", unit(0, 0, 0, 0)]
];
const kRejected = [
  "rgb(255, 102)",
  "rgb(255, 102, 0, 1, 1)",
  "rgb(255 102)",
  "rgb(255, 102, 0 / 0.5)",
  "rgb(255 102 0 / 0.5 / 1)",
  "rgb(255, 102, red)",
  "rgb(255 102 0",
  "rgb 255 102 0",
  "rgb()",
  "rgb(255 102 0 /)"
];

describe("parseColor / rgb", () => {
  for (const [input, expected] of kFixtures) {
    test(`parses '${input}'`, () => {
      assert.deepEqual(parseColor(input), expected);
    });
  }

  test("clamps out-of-range channels rather than failing", () => {
    for (const [input, expected] of kClamped) {
      assert.deepEqual(parseColor(input), expected, input);
    }
  });

  test("rejects malformed input", () => {
    for (const input of kRejected) {
      assert.equal(parseColor(input), null, input);
    }
  });
});
