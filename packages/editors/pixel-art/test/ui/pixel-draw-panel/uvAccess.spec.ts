// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isUvAccess,
  modeAllowedBy
} from "../../../src/ui/pixel-draw-panel/uvAccess.ts";

describe("isUvAccess", () => {
  test("accepts the three levels", () => {
    assert.equal(isUvAccess("edit"), true);
    assert.equal(isUvAccess("view"), true);
    assert.equal(isUvAccess("none"), true);
  });

  test("rejects anything else", () => {
    assert.equal(isUvAccess(""), false);
    assert.equal(isUvAccess("EDIT"), false);
    assert.equal(isUvAccess("uv"), false);
  });
});

describe("modeAllowedBy", () => {
  test("keeps UV mode when UV is editable", () => {
    assert.equal(modeAllowedBy("uv", "edit"), "uv");
  });

  test("falls back to paint when UV is not editable", () => {
    assert.equal(modeAllowedBy("uv", "view"), "paint");
    assert.equal(modeAllowedBy("uv", "none"), "paint");
  });

  test("leaves other modes untouched", () => {
    for (const access of ["edit", "view", "none"] as const) {
      assert.equal(modeAllowedBy("fill", access), "fill");
      assert.equal(modeAllowedBy("move", access), "move");
    }
  });
});
