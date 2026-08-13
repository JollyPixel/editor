// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  dispatchTag,
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
