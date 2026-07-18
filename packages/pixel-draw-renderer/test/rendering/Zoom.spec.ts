// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Zoom } from "../../src/rendering/Zoom.ts";

describe("Zoom", () => {
  describe("constructor", () => {
    test("throws when max < min", () => {
      assert.throws(
        () => new Zoom({ min: 4, max: 2 }),
        /Max zoom.*can't be under min zoom/
      );
    });

    test("clamps the initial value to [min, max]", () => {
      const zoom = new Zoom({ default: 100, min: 1, max: 32 });
      assert.strictEqual(zoom.value, 32);
    });

    test("defaults value to 4, min to 1, max to 32, sensitivity to 0.1", () => {
      const zoom = new Zoom();
      assert.strictEqual(zoom.value, 4);
      assert.strictEqual(zoom.min, 1);
      assert.strictEqual(zoom.max, 32);
      assert.strictEqual(zoom.sensitivity, 0.1);
    });
  });

  describe("sensitivity setter", () => {
    test("updates sensitivity", () => {
      const zoom = new Zoom();
      zoom.sensitivity = 0.5;
      assert.strictEqual(zoom.sensitivity, 0.5);
    });

    test("clamps to a minimum of 0.01", () => {
      const zoom = new Zoom();
      zoom.sensitivity = -5;
      assert.strictEqual(zoom.sensitivity, 0.01);
    });
  });

  describe("applyDelta", () => {
    test("negative delta increases the value", () => {
      const zoom = new Zoom({ default: 4 });
      const before = zoom.value;
      const after = zoom.applyDelta(-1);
      assert.ok(after > before, `zoom ${after} should be greater than ${before}`);
      assert.strictEqual(zoom.value, after);
    });

    test("positive delta decreases the value", () => {
      const zoom = new Zoom({ default: 4 });
      const before = zoom.value;
      const after = zoom.applyDelta(1);
      assert.ok(after < before, `zoom ${after} should be less than ${before}`);
    });

    test("clamps to min", () => {
      const zoom = new Zoom({ default: 1, min: 1 });
      zoom.applyDelta(100);
      assert.strictEqual(zoom.value, 1);
    });

    test("clamps to max", () => {
      const zoom = new Zoom({ default: 32, max: 32 });
      zoom.applyDelta(-100);
      assert.strictEqual(zoom.value, 32);
    });
  });
});
