// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { contrastingColor } from "../src/contrast.ts";
import { ColorParseError } from "../src/parse/index.ts";

describe("contrastingColor", () => {
  test("picks the ink with the higher WCAG contrast ratio", () => {
    assert.equal(contrastingColor("#ffffff"), "#000");
    assert.equal(contrastingColor("#000000"), "#fff");
    assert.equal(contrastingColor("#f9c74f"), "#000");
    assert.equal(contrastingColor("#277da1"), "#fff");
  });

  test("puts black ink on saturated red and mid gray", () => {
    assert.equal(contrastingColor("#ff0000"), "#000");
    assert.equal(contrastingColor("#808080"), "#000");
    assert.equal(contrastingColor("#0000ff"), "#fff");
  });

  test("switches ink where both ratios meet", () => {
    assert.equal(contrastingColor("#767676"), "#000");
    assert.equal(contrastingColor("#757575"), "#fff");
  });

  test("ignores alpha", () => {
    assert.equal(contrastingColor("#ffffff00"), "#000");
  });

  test("accepts an already parsed color", () => {
    assert.equal(contrastingColor({ r: 1, g: 1, b: 1, a: 1 }), "#000");
  });

  test("throws on unparseable input", () => {
    assert.throws(
      () => contrastingColor("not-a-color"),
      ColorParseError
    );
  });
});
