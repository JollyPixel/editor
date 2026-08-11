// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { sizeFromDelta } from "../src/index.ts";

describe("sizeFromDelta", () => {
  test("grows from a start-edge handle", () => {
    assert.equal(sizeFromDelta({
      initialSize: 200,
      startDrag: 100,
      current: 150,
      fromStart: true,
      min: 0,
      max: Number.POSITIVE_INFINITY
    }), 250);
  });

  test("grows from an end-edge handle", () => {
    assert.equal(sizeFromDelta({
      initialSize: 200,
      startDrag: 100,
      current: 50,
      fromStart: false,
      min: 0,
      max: Number.POSITIVE_INFINITY
    }), 250);
  });

  test("clamps to both bounds", () => {
    const options = {
      initialSize: 200,
      startDrag: 100,
      fromStart: true,
      min: 120,
      max: 280
    };

    assert.equal(sizeFromDelta({
      ...options,
      current: -100
    }), 120);
    assert.equal(sizeFromDelta({
      ...options,
      current: 500
    }), 280);
  });
});
