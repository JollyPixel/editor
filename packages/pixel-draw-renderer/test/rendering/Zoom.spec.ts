// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Zoom } from "#src/rendering/Zoom.ts";

describe("Zoom", () => {
  describe("constructor", () => {
    test("throws when max < min", () => {
      assert.throws(
        () => new Zoom({
          min: 4,
          max: 2
        }),
        /Max zoom.*can't be under min zoom/
      );
    });

    test("clamps the initial value to [min, max]", () => {
      const zoom = new Zoom({
        default: 100,
        min: 1,
        max: 32
      });

      assert.strictEqual(zoom.value, 32);
      assert.strictEqual(zoom.target, 32);
    });

    test("defaults value to 4, min to 1, max to 32, sensitivity to 0.25, smoothing to 50", () => {
      const zoom = new Zoom();

      assert.strictEqual(zoom.value, 4);
      assert.strictEqual(zoom.min, 1);
      assert.strictEqual(zoom.max, 32);
      assert.strictEqual(zoom.sensitivity, 0.25);
      assert.strictEqual(zoom.smoothing, 50);
      assert.strictEqual(zoom.isAnimating, false);
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

  describe("smoothing setter", () => {
    test("clamps to a minimum of 0", () => {
      const zoom = new Zoom();
      zoom.smoothing = -5;

      assert.strictEqual(zoom.smoothing, 0);
    });

    test("settles a running animation when set to 0", () => {
      const zoom = new Zoom();
      zoom.applyDelta(-100);
      zoom.smoothing = 0;

      assert.strictEqual(zoom.isAnimating, false);
      assert.strictEqual(zoom.value, zoom.target);
    });
  });

  describe("applyDelta", () => {
    test("negative delta increases the target", () => {
      const zoom = new Zoom({
        default: 4
      });
      const after = zoom.applyDelta(-100);

      assert.ok(after > 4, `zoom ${after} should be greater than 4`);
      assert.strictEqual(zoom.target, after);
    });

    test("positive delta decreases the target", () => {
      const zoom = new Zoom({
        default: 4
      });
      const after = zoom.applyDelta(100);

      assert.ok(after < 4, `zoom ${after} should be less than 4`);
    });

    test("leaves value unchanged while easing", () => {
      const zoom = new Zoom({
        default: 4
      });
      zoom.applyDelta(-100);

      assert.strictEqual(zoom.value, 4);
      assert.strictEqual(zoom.isAnimating, true);
    });

    test("applies the target at once without smoothing", () => {
      const zoom = new Zoom({
        default: 4,
        smoothing: 0
      });
      zoom.applyDelta(-100);

      assert.strictEqual(zoom.value, zoom.target);
      assert.strictEqual(zoom.isAnimating, false);
    });

    test("scales by sensitivity per notch at min", () => {
      const zoom = new Zoom({
        default: 1,
        sensitivity: 0.25,
        smoothing: 0
      });
      zoom.applyDelta(-100);

      assert.strictEqual(zoom.value, 1.25);
    });

    test("halves the relative step at max", () => {
      const zoom = new Zoom({
        default: 2,
        min: 0.25,
        max: 2,
        sensitivity: 0.25,
        smoothing: 0
      });
      zoom.applyDelta(100);

      assert.ok(Math.abs(zoom.value - (2 / 1.125)) < 1e-9);
    });

    test("snaps a target within 3% of a whole zoom level", () => {
      const zoom = new Zoom({
        default: 2.95,
        smoothing: 0
      });
      zoom.applyDelta(-1);

      assert.strictEqual(zoom.value, 3);
    });

    test("small deltas accumulate past a whole zoom level", () => {
      const zoom = new Zoom({
        default: 4,
        smoothing: 0
      });
      zoom.applyDelta(-1);
      assert.strictEqual(zoom.value, 4);

      for (let i = 0; i < 20; i++) {
        zoom.applyDelta(-1);
      }
      assert.ok(zoom.value > 4, `zoom ${zoom.value} should leave 4`);
    });

    test("clamps to min", () => {
      const zoom = new Zoom({
        default: 1,
        min: 1
      });
      zoom.applyDelta(100);

      assert.strictEqual(zoom.target, 1);
    });

    test("clamps to max", () => {
      const zoom = new Zoom({
        default: 32,
        max: 32
      });
      zoom.applyDelta(-100);

      assert.strictEqual(zoom.target, 32);
    });
  });

  describe("update", () => {
    test("returns false at rest", () => {
      const zoom = new Zoom();

      assert.strictEqual(zoom.update(16), false);
    });

    test("eases value toward the target", () => {
      const zoom = new Zoom({
        default: 4
      });
      const target = zoom.applyDelta(-100);

      assert.strictEqual(zoom.update(16), true);
      assert.ok(zoom.value > 4 && zoom.value < target);
    });

    test("settles on the target", () => {
      const zoom = new Zoom({
        default: 4
      });
      const target = zoom.applyDelta(-100);

      assert.strictEqual(zoom.update(1000), false);
      assert.strictEqual(zoom.value, target);
      assert.strictEqual(zoom.isAnimating, false);
    });
  });

  describe("settle", () => {
    test("jumps value to the target", () => {
      const zoom = new Zoom({
        default: 4
      });
      const target = zoom.applyDelta(100);
      zoom.settle();

      assert.strictEqual(zoom.value, target);
      assert.strictEqual(zoom.isAnimating, false);
    });
  });
});
