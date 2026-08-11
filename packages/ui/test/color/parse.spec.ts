// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseColor } from "../../src/color/parse.ts";

describe("Color.parseColor", () => {
  test("accepts a full hex with or without the hash", () => {
    const expected = {
      r: 255,
      g: 102,
      b: 0,
      a: 1
    };

    assert.deepEqual(
      parseColor("#ff6600"),
      expected
    );
    assert.deepEqual(
      parseColor("ff6600"),
      expected
    );
  });

  test("expands three digit shorthand", () => {
    const expected = {
      r: 255,
      g: 102,
      b: 0,
      a: 1
    };

    assert.deepEqual(
      parseColor("#f60"),
      expected
    );
    assert.deepEqual(
      parseColor("f60"),
      expected
    );
  });

  test("rejects four digit shorthand, which collides with partial input", () => {
    // "#ff66" is what typing "#ff6600" looks like halfway through.
    assert.equal(
      parseColor("#f60f"),
      null
    );
  });

  test("reads the alpha pair of an eight digit hex", () => {
    const parsed = parseColor("#ff660080");

    assert.equal(parsed?.r, 255);
    assert.equal(
      parsed?.a,
      128 / 255
    );
  });

  test("is case insensitive, so two spellings of one colour compare equal", () => {
    assert.deepEqual(
      parseColor("#FF6600"),
      parseColor("#ff6600")
    );
    assert.deepEqual(
      parseColor("#F60"),
      parseColor("#ff6600")
    );
  });

  test("trims surrounding whitespace", () => {
    assert.deepEqual(
      parseColor("  #ff6600 "),
      parseColor("#ff6600")
    );
  });

  test("rejects a partial value, which is what typing produces", () => {
    assert.equal(
      parseColor("#ff66"),
      null
    );
    assert.equal(
      parseColor("#f"),
      null
    );
    assert.equal(
      parseColor("#"),
      null
    );
    assert.equal(
      parseColor(""),
      null
    );
  });

  test("rejects lengths between the accepted ones", () => {
    assert.equal(
      parseColor("#ff6600f"),
      null
    );
    assert.equal(
      parseColor("#ff6600ffff"),
      null
    );
  });

  test("rejects non hex characters, named colours and functions", () => {
    assert.equal(
      parseColor("#gggggg"),
      null
    );
    assert.equal(
      parseColor("rebeccapurple"),
      null
    );
    assert.equal(
      parseColor("rgb(1,2,3)"),
      null
    );
  });
});
