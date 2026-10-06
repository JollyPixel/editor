// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  closest,
  prefixTypoDistance,
  typoTolerance
} from "#src/search/typo.ts";

describe("typoTolerance", () => {
  test("allows no edit below 4 characters, one below 8, then two", () => {
    assert.deepEqual([1, 3, 4, 7, 8, 20].map(typoTolerance), [0, 0, 1, 1, 2, 2]);
  });
});

describe("prefixTypoDistance", () => {
  test("measures against the candidate prefix of about the typed length", () => {
    assert.equal(prefixTypoDistance("brsh.si", "brush.size"), 1);
    assert.equal(prefixTypoDistance("BRUSH.SIZE", "brush.size"), 0);
    assert.equal(prefixTypoDistance("helpp", "help"), 1);
    assert.equal(prefixTypoDistance("grwo", "grow"), 1);
  });

  test("rejects distances above the tolerance and short input", () => {
    assert.equal(prefixTypoDistance("hep", "help"), null);
    assert.equal(prefixTypoDistance("camera", "brush.size"), null);
  });
});

describe("closest", () => {
  test("picks the smallest full distance within tolerance", () => {
    assert.equal(closest("brush.sise", ["brush.shape", "brush.size"]), "brush.size");
    assert.equal(closest("brush.sze", ["brush.size"]), "brush.size");
    assert.equal(closest("zoom", ["brush.size"]), null);
  });

  test("breaks ties alphabetically", () => {
    assert.equal(closest("brush.sizz", ["brush.sizy", "brush.sizx"]), "brush.sizx");
  });
});
