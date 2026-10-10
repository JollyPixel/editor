// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UvAccessPolicy
} from "../../src/uv/UvAccessPolicy.ts";

describe("UvAccessPolicy.isAccess", () => {
  test("accepts the three levels", () => {
    assert.equal(UvAccessPolicy.isAccess("edit"), true);
    assert.equal(UvAccessPolicy.isAccess("view"), true);
    assert.equal(UvAccessPolicy.isAccess("none"), true);
  });

  test("rejects anything else", () => {
    assert.equal(UvAccessPolicy.isAccess(""), false);
    assert.equal(UvAccessPolicy.isAccess("EDIT"), false);
    assert.equal(UvAccessPolicy.isAccess("uv"), false);
    assert.equal(UvAccessPolicy.isAccess("toString"), false);
  });
});

describe("UvAccessPolicy.forAccess", () => {
  test("returns one shared frozen instance per level", () => {
    const policy = UvAccessPolicy.forAccess("view");

    assert.equal(UvAccessPolicy.forAccess("view"), policy);
    assert.equal(policy.access, "view");
    assert.ok(Object.isFrozen(policy));
  });

  test("limits editing to viewing when UV edits are not granted", () => {
    assert.equal(UvAccessPolicy.forAccess("edit", false).access, "view");
    assert.equal(UvAccessPolicy.forAccess("view", false).access, "view");
    assert.equal(UvAccessPolicy.forAccess("none", false).access, "none");
  });
});

describe("UvAccessPolicy.constrain", () => {
  test("keeps UV mode when UV is editable", () => {
    assert.equal(UvAccessPolicy.forAccess("edit").constrain("uv"), "uv");
  });

  test("falls back to paint when UV is not editable", () => {
    assert.equal(UvAccessPolicy.forAccess("view").constrain("uv"), "paint");
    assert.equal(UvAccessPolicy.forAccess("none").constrain("uv"), "paint");
  });

  test("leaves other modes untouched", () => {
    for (const access of ["edit", "view", "none"] as const) {
      const policy = UvAccessPolicy.forAccess(access);

      assert.equal(policy.constrain("fill"), "fill");
      assert.equal(policy.constrain("move"), "move");
    }
  });
});

describe("UvAccessPolicy flags", () => {
  function flags(
    policy: UvAccessPolicy
  ) {
    return {
      uvMode: policy.uvMode,
      visibilityInBottomBar: policy.visibilityInBottomBar,
      fillClip: policy.fillClip
    };
  }

  test("exposes UV mode and the fill clip when editable", () => {
    assert.deepEqual(flags(UvAccessPolicy.forAccess("edit")), {
      uvMode: true,
      visibilityInBottomBar: false,
      fillClip: true
    });
  });

  test("moves the visibility toggles to the bottom bar when view-only", () => {
    assert.deepEqual(flags(UvAccessPolicy.forAccess("view")), {
      uvMode: false,
      visibilityInBottomBar: true,
      fillClip: true
    });
  });

  test("hides every UV control when disabled", () => {
    assert.deepEqual(flags(UvAccessPolicy.forAccess("none")), {
      uvMode: false,
      visibilityInBottomBar: false,
      fillClip: false
    });
  });
});
