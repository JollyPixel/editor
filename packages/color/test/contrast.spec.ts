// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  contrastingColor,
  contrastRatio,
  relativeLuminance
} from "../src/contrast.ts";
import { ColorParseError } from "../src/parse/index.ts";

// CONSTANTS
const kBlack = {
  r: 0,
  g: 0,
  b: 0,
  a: 1
};
const kWhite = {
  r: 1,
  g: 1,
  b: 1,
  a: 1
};

describe("relativeLuminance", () => {
  test("spans 0 to 1", () => {
    assert.equal(relativeLuminance(kBlack), 0);
    assert.equal(relativeLuminance(kWhite), 1);
  });

  test("weights green above red above blue", () => {
    const red = relativeLuminance({ r: 1, g: 0, b: 0, a: 1 });
    const green = relativeLuminance({ r: 0, g: 1, b: 0, a: 1 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 1, a: 1 });

    assert.ok(green > red);
    assert.ok(red > blue);
  });
});

describe("contrastRatio", () => {
  test("black on white is 21", () => {
    assert.equal(
      Number(contrastRatio(kBlack, kWhite).toFixed(2)),
      21
    );
  });

  test("is order independent and bottoms out at 1", () => {
    assert.equal(contrastRatio(kWhite, kBlack), contrastRatio(kBlack, kWhite));
    assert.equal(contrastRatio(kWhite, kWhite), 1);
  });
});

describe("contrastingColor", () => {
  test("picks the opposite of the perceived brightness", () => {
    assert.equal(contrastingColor("#ffffff"), "#000");
    assert.equal(contrastingColor("#000000"), "#fff");
  });

  test("treats mid-tone yellow as light and mid-tone blue as dark", () => {
    assert.equal(contrastingColor("#f9c74f"), "#000");
    assert.equal(contrastingColor("#277da1"), "#fff");
  });

  test("ignores alpha", () => {
    assert.equal(contrastingColor("#ffffff00"), "#000");
  });

  test("accepts an already parsed color", () => {
    assert.equal(contrastingColor(kWhite), "#000");
  });

  test("throws on unparseable input", () => {
    assert.throws(
      () => contrastingColor("not-a-color"),
      ColorParseError
    );
  });
});
