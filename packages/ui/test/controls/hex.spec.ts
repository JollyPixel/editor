// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { normalizeHex } from "../../src/controls/hex.ts";

describe("Controls.normalizeHex", () => {
  test("accepts a full hex with or without the hash", () => {
    assert.equal(
      normalizeHex("#ff6600"),
      "#ff6600"
    );
    assert.equal(
      normalizeHex("ff6600"),
      "#ff6600"
    );
  });

  test("expands shorthand", () => {
    assert.equal(
      normalizeHex("#f60"),
      "#ff6600"
    );
    assert.equal(
      normalizeHex("f60"),
      "#ff6600"
    );
  });

  test("lowercases, so two spellings of one colour compare equal", () => {
    assert.equal(
      normalizeHex("#FF6600"),
      "#ff6600"
    );
    assert.equal(
      normalizeHex("#F60"),
      "#ff6600"
    );
  });

  test("trims surrounding whitespace", () => {
    assert.equal(
      normalizeHex("  #ff6600 "),
      "#ff6600"
    );
  });

  test("rejects a partial value, which is what typing produces", () => {
    assert.equal(
      normalizeHex("#ff66"),
      null
    );
    assert.equal(
      normalizeHex("#f"),
      null
    );
    assert.equal(
      normalizeHex("#"),
      null
    );
    assert.equal(
      normalizeHex(""),
      null
    );
  });

  test("rejects non hex characters and named colours", () => {
    assert.equal(
      normalizeHex("#gggggg"),
      null
    );
    assert.equal(
      normalizeHex("rebeccapurple"),
      null
    );
    assert.equal(
      normalizeHex("rgb(1,2,3)"),
      null
    );
  });

  test("rejects eight digit hex, since the swatch carries no alpha", () => {
    assert.equal(
      normalizeHex("#ff6600ff"),
      null
    );
  });
});
