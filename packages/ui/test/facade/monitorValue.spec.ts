// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { displayMonitorValue } from "../../src/facade/monitorValue.ts";

describe("facade.displayMonitorValue", () => {
  test("passes a number and a string straight through", () => {
    assert.equal(displayMonitorValue(42), 42);
    assert.equal(displayMonitorValue("idle"), "idle");
  });

  test("joins a vector's axes", () => {
    assert.equal(
      displayMonitorValue({ x: -2, y: 0, z: 4 }),
      "-2, 0, 4"
    );
  });

  test("rounds to two decimals and drops trailing zeros", () => {
    assert.equal(
      displayMonitorValue({ x: 1.567, y: 2.5, z: 3 }),
      "1.57, 2.5, 3"
    );
  });

  test("honours a precision of zero", () => {
    assert.equal(
      displayMonitorValue({ x: 1.6, y: 2.4 }, { precision: 0 }),
      "2, 2"
    );
  });

  test("format wins over the vector default", () => {
    assert.equal(
      displayMonitorValue(
        { x: 1, y: 2, z: 3 },
        { format: (value) => `(${value.x})` }
      ),
      "(1)"
    );
  });

  test("format applies to a string, which the element alone cannot do", () => {
    assert.equal(
      displayMonitorValue("area", { format: (value) => value.toUpperCase() }),
      "AREA"
    );
  });
});
