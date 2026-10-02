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
    assert.equal(kNamedColors.size, 148);
  });

  test("every listed name is reachable through parseColor", () => {
    for (const name of kNamedColors.keys()) {
      assert.notEqual(parseColor(name), null, name);
    }
  });

  test("rejects unknown names", () => {
    assert.equal(parseColor("nosuchcolor"), null);
    assert.equal(parseColor("reddish blue"), null);
  });

  test("rejects object prototype keys", () => {
    for (const input of ["constructor", "__proto__", "hasOwnProperty"]) {
      assert.equal(parseColor(input), null, input);
    }
  });
});
