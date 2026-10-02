// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SampleRing } from "../../src/monitors/SampleRing.ts";

function samplesOf(
  ring: SampleRing
): number[] {
  return Array.from(
    { length: ring.length },
    (_, index) => ring.at(index)
  );
}

function spliceModel(
  values: number[],
  value: number,
  limit: number
): void {
  values.push(value);
  if (values.length > limit) {
    values.splice(0, values.length - limit);
  }
}

describe("monitors.SampleRing", () => {
  test("starts empty and holds one sample after a reset", () => {
    const ring = new SampleRing();
    assert.equal(ring.length, 0);

    ring.push(4, 3);
    ring.push(5, 3);
    ring.reset(7);

    assert.deepEqual(samplesOf(ring), [7]);
  });

  test("keeps the newest samples, oldest first", () => {
    const ring = new SampleRing();
    for (let value = 1; value <= 5; value++) {
      ring.push(value, 3);
    }

    assert.deepEqual(samplesOf(ring), [3, 4, 5]);
  });

  test("keeps existing samples when the limit grows", () => {
    const ring = new SampleRing();
    ring.push(1, 2);
    ring.push(2, 2);
    ring.push(3, 4);
    ring.push(4, 4);

    assert.deepEqual(samplesOf(ring), [1, 2, 3, 4]);
  });

  test("drops down to the newest samples when the limit shrinks", () => {
    const ring = new SampleRing();
    for (let value = 1; value <= 6; value++) {
      ring.push(value, 6);
    }
    ring.push(7, 2);

    assert.deepEqual(samplesOf(ring), [6, 7]);
  });

  test("grows past its initial capacity in order", () => {
    const ring = new SampleRing();
    const expected: number[] = [];
    for (let value = 0; value < 300; value++) {
      ring.push(value, 200);
      spliceModel(expected, value, 200);
    }

    assert.deepEqual(samplesOf(ring), expected);
  });

  test("trims like Array#splice for degenerate limits", () => {
    for (const limit of [0, -2, 2.5, Number.NaN, Infinity, -Infinity]) {
      const ring = new SampleRing();
      const expected: number[] = [];
      for (let value = 0; value < 8; value++) {
        ring.push(value, limit);
        spliceModel(expected, value, limit);
      }

      assert.deepEqual(samplesOf(ring), expected, `limit ${limit}`);
    }
  });

  test("reports the extremes of the held samples", () => {
    const ring = new SampleRing();
    for (const value of [9, -3, 4, 12, 0]) {
      ring.push(value, 4);
    }

    assert.equal(ring.min(), -3);
    assert.equal(ring.max(), 12);
  });

  test("propagates NaN to the extremes like Math.min and Math.max", () => {
    const ring = new SampleRing();
    ring.push(1, 4);
    ring.push(Number.NaN, 4);

    assert.ok(Number.isNaN(ring.min()));
    assert.ok(Number.isNaN(ring.max()));
  });
});
