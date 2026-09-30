// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Interpolated, lerpNumber } from "../src/index.ts";

interface Point {
  x: number;
  y: number;
}

function lerpPoint(
  previous: Point,
  current: Point,
  alpha: number
): Point {
  return {
    x: lerpNumber(previous.x, current.x, alpha),
    y: lerpNumber(previous.y, current.y, alpha)
  };
}

describe("Loop.lerpNumber", () => {
  test("blends the endpoints", () => {
    assert.strictEqual(lerpNumber(0, 10, 0), 0);
    assert.strictEqual(lerpNumber(0, 10, 1), 10);
    assert.strictEqual(lerpNumber(0, 10, 0.25), 2.5);
    assert.strictEqual(lerpNumber(-10, 10, 0.5), 0);
  });
});

describe("Loop.Interpolated", () => {
  test("starts with both samples on the initial value", () => {
    const value = new Interpolated(5, lerpNumber);

    assert.strictEqual(value.previous, 5);
    assert.strictEqual(value.current, 5);
    assert.strictEqual(value.at(0.5), 5);
  });

  test("push() shifts current into previous", () => {
    const value = new Interpolated(0, lerpNumber);

    value.push(10);
    assert.strictEqual(value.previous, 0);
    assert.strictEqual(value.current, 10);

    value.push(30);
    assert.strictEqual(value.previous, 10);
    assert.strictEqual(value.current, 30);
    assert.strictEqual(value.at(0.5), 20);
  });

  test("at() clamps alpha instead of extrapolating", () => {
    const value = new Interpolated(0, lerpNumber).push(10);

    assert.strictEqual(value.at(-1), 0);
    assert.strictEqual(value.at(0), 0);
    assert.strictEqual(value.at(1), 10);
    assert.strictEqual(value.at(4), 10);
  });

  test("reset() cancels the blend so a teleport is not smeared", () => {
    const value = new Interpolated(0, lerpNumber).push(10);

    value.reset(100);

    assert.strictEqual(value.previous, 100);
    assert.strictEqual(value.current, 100);
    assert.strictEqual(value.at(0.5), 100);
  });

  test("carries any type its lerp understands", () => {
    const point = new Interpolated<Point>(
      { x: 0, y: 0 },
      lerpPoint
    );

    point.push({ x: 10, y: 20 });

    assert.deepStrictEqual(point.at(0.5), { x: 5, y: 10 });
    assert.deepStrictEqual(point.current, { x: 10, y: 20 });
  });

  test("the lerp is only consulted between the endpoints", () => {
    let calls = 0;
    const value = new Interpolated(0, (previous, current, alpha) => {
      calls++;

      return lerpNumber(previous, current, alpha);
    });

    value.push(10);
    value.at(0);
    value.at(1);
    assert.strictEqual(calls, 0);

    value.at(0.5);
    assert.strictEqual(calls, 1);
  });
});
