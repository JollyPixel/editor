// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { is } from "#src/index.ts";

describe("is.object", () => {
  test("accepts arrays and class instances but not null", () => {
    assert.equal(is.object([]), true);
    assert.equal(is.object(new Map()), true);
    assert.equal(is.object(null), false);
    assert.equal(is.object("text"), false);
  });
});

describe("is.plainObject", () => {
  test("accepts object literals and null-prototype objects", () => {
    assert.equal(is.plainObject({ x: 1 }), true);
    assert.equal(is.plainObject(Object.create(null)), true);
    assert.equal(is.plainObject(JSON.parse("{\"v\":1}")), true);
  });

  for (const [label, value] of [
    ["null", null],
    ["an array", []],
    ["a class instance", new Date()],
    ["a string", "{}"]
  ] as const) {
    test(`rejects ${label}`, () => {
      assert.equal(is.plainObject(value), false);
    });
  }
});

describe("is.member", () => {
  const kModes = ["light", "dark", "auto"] as const;

  test("accepts listed values only", () => {
    assert.equal(is.member("dark", kModes), true);
    assert.equal(is.member("Dark", kModes), false);
    assert.equal(is.member(null, kModes), false);
  });
});
