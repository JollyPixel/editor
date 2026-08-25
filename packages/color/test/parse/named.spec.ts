// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseColor } from "../../src/parse/index.ts";
import { kNamedColors } from "../../src/parse/names.ts";
import type { RGBA } from "../../src/types.ts";
import { unit } from "../helpers/channels.ts";

// CONSTANTS
const kFixtures: [string, RGBA][] = [
  ["red", unit(255, 0, 0)],
  ["RED", unit(255, 0, 0)],
  ["  rebeccapurple  ", unit(102, 51, 153)],
  ["cornflowerblue", unit(100, 149, 237)],
  ["transparent", unit(0, 0, 0, 0)]
];

describe("parseColor / named", () => {
  for (const [input, expected] of kFixtures) {
    test(`parses '${input}'`, () => {
      assert.deepEqual(parseColor(input), expected);
    });
  }

  test("carries the 148 CSS named colors", () => {
    assert.equal(Object.keys(kNamedColors).length, 148);
  });

  test("every name parses to an in-range color", () => {
    for (const name of Object.keys(kNamedColors)) {
      const color = parseColor(name);
      if (color === null) {
        assert.fail(`${name} did not parse`);
      }

      for (const channel of Object.values(color)) {
        assert.ok(channel >= 0 && channel <= 1, `${name}: ${channel}`);
      }
    }
  });

  test("rejects unknown names", () => {
    assert.equal(parseColor("nosuchcolor"), null);
    assert.equal(parseColor("reddish blue"), null);
  });
});
