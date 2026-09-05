// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isQuatLike,
  isTransformLike,
  isVec2Like,
  isVec3Like,
  isVec4Like,
  vec2PairOf
} from "../../src/math/guards.ts";

describe("Math.guards.isVec2Like", () => {
  test("accepts two numeric axes", () => {
    assert.ok(isVec2Like({ x: 1, y: 2 }));
  });

  test("accepts a wider value", () => {
    assert.ok(isVec2Like({ x: 1, y: 2, z: 3 }));
  });

  test("rejects a non-numeric axis", () => {
    assert.equal(isVec2Like({ x: 1, y: "2" }), false);
  });

  test("rejects null and a primitive", () => {
    assert.equal(isVec2Like(null), false);
    assert.equal(isVec2Like(4), false);
  });
});

describe("Math.guards.isVec3Like", () => {
  test("rejects a two-axis value", () => {
    assert.equal(isVec3Like({ x: 1, y: 2 }), false);
  });

  test("accepts a class instance carrying the axes", () => {
    class Point {
      x = 1;
      y = 2;
      z = 3;
      length(): number {
        return 0;
      }
    }

    assert.ok(isVec3Like(new Point()));
  });
});

describe("Math.guards.isVec4Like", () => {
  test("rejects a three-axis value", () => {
    assert.equal(isVec4Like({ x: 1, y: 2, z: 3 }), false);
  });

  test("matches isQuatLike on the same shape", () => {
    const value = { x: 0, y: 0, z: 0, w: 1 };

    assert.ok(isVec4Like(value));
    assert.ok(isQuatLike(value));
  });
});

describe("Math.guards.isTransformLike", () => {
  test("accepts position, rotation and scale", () => {
    assert.ok(isTransformLike({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }));
  });

  test("rejects a three-axis rotation", () => {
    assert.equal(isTransformLike({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }), false);
  });
});

describe("Math.guards.vec2PairOf", () => {
  test("names the plane a two-axis value carries", () => {
    assert.equal(vec2PairOf({ x: 1, y: 2 }), "xy");
    assert.equal(vec2PairOf({ x: 1, z: 2 }), "xz");
    assert.equal(vec2PairOf({ y: 1, z: 2 }), "yz");
  });

  test("reads the axes in xyz order whatever the key order", () => {
    assert.equal(vec2PairOf({ z: 2, x: 1 }), "xz");
  });

  test("rejects a three-axis value", () => {
    assert.equal(vec2PairOf({ x: 1, y: 2, z: 3 }), null);
  });

  test("rejects a four-axis value", () => {
    assert.equal(vec2PairOf({ x: 1, y: 2, z: 3, w: 4 }), null);
  });

  test("rejects a single axis", () => {
    assert.equal(vec2PairOf({ x: 1 }), null);
  });

  test("rejects a non-numeric axis", () => {
    assert.equal(vec2PairOf({ x: 1, z: "2" }), null);
  });

  test("rejects null and a primitive", () => {
    assert.equal(vec2PairOf(null), null);
    assert.equal(vec2PairOf(4), null);
  });
});
