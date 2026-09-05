// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  axisKeysOf,
  rekeyVectorValue,
  sameAxisKeys
} from "../../src/math/axes.ts";
import { Mixed } from "../../src/field/mixed.ts";

describe("Math.axes.axisKeysOf", () => {
  test("names the axes of each pair", () => {
    assert.deepEqual(axisKeysOf("xy"), ["x", "y"]);
    assert.deepEqual(axisKeysOf("xz"), ["x", "z"]);
    assert.deepEqual(axisKeysOf("yz"), ["y", "z"]);
  });

  test("falls back to xy for an unset pair", () => {
    assert.deepEqual(axisKeysOf(undefined), ["x", "y"]);
  });

  test("falls back to xy for an unknown pair", () => {
    assert.deepEqual(
      axisKeysOf("zw" as "xy"),
      ["x", "y"]
    );
  });
});

describe("Math.axes.sameAxisKeys", () => {
  test("compares by position", () => {
    assert.ok(sameAxisKeys(["x", "z"], ["x", "z"]));
    assert.equal(sameAxisKeys(["x", "z"], ["z", "x"]), false);
    assert.equal(sameAxisKeys(["x"], ["x", "z"]), false);
  });
});

describe("Math.axes.rekeyVectorValue", () => {
  test("moves each axis by position", () => {
    assert.deepEqual(
      rekeyVectorValue({ x: 2, y: 5 }, ["x", "y"], ["x", "z"]),
      { x: 2, z: 5 }
    );
  });

  test("keeps a per-axis Mixed", () => {
    assert.deepEqual(
      rekeyVectorValue({ x: 2, y: Mixed }, ["x", "y"], ["y", "z"]),
      { y: 2, z: Mixed }
    );
  });

  test("returns null when every new axis is already carried", () => {
    assert.equal(
      rekeyVectorValue({ x: 2, z: 5 }, ["x", "y"], ["x", "z"]),
      null
    );
  });

  test("returns null for a whole-value Mixed", () => {
    assert.equal(
      rekeyVectorValue(Mixed, ["x", "y"], ["x", "z"]),
      null
    );
  });

  test("reads the value's own keys without a previous set", () => {
    assert.deepEqual(
      rekeyVectorValue({ x: 2, y: 5 }, null, ["x", "z"]),
      { x: 2, z: 5 }
    );
  });

  test("fills an axis the value cannot supply with zero", () => {
    assert.deepEqual(
      rekeyVectorValue({ x: 2 }, ["x", "y"], ["x", "z"]),
      { x: 2, z: 0 }
    );
  });
});
