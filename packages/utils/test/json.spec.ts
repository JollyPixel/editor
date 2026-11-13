// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseJsonObject } from "#src/index.ts";

describe("parseJsonObject", () => {
  test("returns the parsed object", () => {
    assert.deepEqual(parseJsonObject("{\"size\":4}"), { size: 4 });
  });

  for (const text of [null, "", "{", "[1]", "null", "4"]) {
    test(`returns an empty object for ${JSON.stringify(text)}`, () => {
      assert.deepEqual(parseJsonObject(text), {});
    });
  }
});
