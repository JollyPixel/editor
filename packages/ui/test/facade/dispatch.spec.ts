// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  dispatchTag,
  isMathTag,
  toJollyOptions
} from "../../src/facade/dispatch.ts";

describe("facade.dispatchTag", () => {
  test("dispatches a boolean to jolly-checkbox", () => {
    assert.equal(
      dispatchTag(true),
      "jolly-checkbox"
    );
  });

  test("dispatches an unbounded number to jolly-number", () => {
    assert.equal(
      dispatchTag(5),
      "jolly-number"
    );
  });

  test("keeps a number with only a step at jolly-number", () => {
    assert.equal(
      dispatchTag(5, { step: 1 }),
      "jolly-number"
    );
  });

  test("dispatches a number with min and max to jolly-slider", () => {
    assert.equal(
      dispatchTag(5, { min: 0, max: 10 }),
      "jolly-slider"
    );
  });

  test("dispatches a plain string to jolly-text", () => {
    assert.equal(
      dispatchTag("BoxName"),
      "jolly-text"
    );
  });

  test("dispatches a six digit hex string to jolly-color", () => {
    assert.equal(
      dispatchTag("#4488ff"),
      "jolly-color"
    );
  });

  test("dispatches an eight digit hex string to jolly-color", () => {
    assert.equal(
      dispatchTag("#4488ffcc"),
      "jolly-color"
    );
  });

  test("sniffs a hex color regardless of case", () => {
    assert.equal(
      dispatchTag("#4488FF"),
      "jolly-color"
    );
  });

  test("dispatches any value with options to jolly-select", () => {
    assert.equal(
      dispatchTag("xz", { options: { xz: "xz", xy: "xy", yz: "yz" } }),
      "jolly-select"
    );
  });

  test("options wins over bounds", () => {
    assert.equal(
      dispatchTag(1, {
        min: 0,
        max: 2,
        options: { a: 1, b: 2 }
      }),
      "jolly-select"
    );
  });

  test("dispatches an interval to jolly-range", () => {
    assert.equal(
      dispatchTag({ from: 0, to: 1 }),
      "jolly-range"
    );
  });

  test("dispatches a two-axis value to jolly-vector2", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0 }),
      "jolly-vector2"
    );
  });

  test("dispatches an xz value to jolly-vector2", () => {
    assert.equal(
      dispatchTag({ x: 0, z: 0 }),
      "jolly-vector2"
    );
  });

  test("dispatches a yz value to jolly-vector2", () => {
    assert.equal(
      dispatchTag({ y: 0, z: 0 }),
      "jolly-vector2"
    );
  });

  test("dispatches a three-axis value to jolly-vector3", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0, z: 0 }),
      "jolly-vector3"
    );
  });

  test("dispatches a four-axis value to jolly-vector4", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0, z: 0, w: 1 }),
      "jolly-vector4"
    );
  });

  test("reads a four-axis value as a rotation on request", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0, z: 0, w: 1 }, { view: "quaternion" }),
      "jolly-quaternion"
    );
  });

  test("turns a two-axis value into a pad on request", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0 }, { view: "point2d" }),
      "jolly-point2d"
    );
  });

  test("ignores a view a value does not match", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0, z: 0 }, { view: "quaternion" }),
      "jolly-vector3"
    );
  });

  test("keeps an interval at jolly-range", () => {
    assert.equal(
      dispatchTag({ from: 0, to: 1, x: 0, y: 0 }),
      "jolly-range"
    );
  });

  test("options still win over a vector shape", () => {
    assert.equal(
      dispatchTag({ x: 0, y: 0, z: 0 }, { options: { origin: { x: 0, y: 0, z: 0 } } }),
      "jolly-select"
    );
  });
  test("throws for a value with no matching control", () => {
    assert.throws(() => dispatchTag(undefined), TypeError);
  });
});

describe("facade.toJollyOptions", () => {
  test("maps a label to value record into JollyOption entries", () => {
    assert.deepEqual(
      toJollyOptions({ xz: "xz", xy: "xy", yz: "yz" }),
      [
        { value: "xz", label: "xz" },
        { value: "xy", label: "xy" },
        { value: "yz", label: "yz" }
      ]
    );
  });

  test("keeps declaration order", () => {
    const options = toJollyOptions({
      off: 0,
      overlay: 1,
      wireframe: 2
    });

    assert.deepEqual(
      options.map((option) => option.label),
      ["off", "overlay", "wireframe"]
    );
  });
});

describe("facade.isMathTag", () => {
  test("covers every dispatched math control", () => {
    for (const tag of [
      "jolly-point2d",
      "jolly-quaternion",
      "jolly-vector2",
      "jolly-vector3",
      "jolly-vector4"
    ] as const) {
      assert.ok(isMathTag(tag), tag);
    }
  });

  test("leaves a scalar control alone", () => {
    assert.equal(isMathTag("jolly-number"), false);
    assert.equal(isMathTag("jolly-range"), false);
  });
});
