// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Interpolated, lerpNumber, GameLoop, ManualFrameSource } from "../src/index.ts";

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
    const point = new Interpolated<Point>({ x: 0, y: 0 }, lerpPoint);

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

  test("smooths a value stepped at 10Hz and drawn at 60Hz", () => {
    const source = new ManualFrameSource();
    const loop = new GameLoop({ source, fixedFps: 10 });
    const position = new Interpolated(0, lerpNumber);
    const smoothed: number[] = [];
    const raw: number[] = [];
    let simulated = 0;

    loop.start({
      fixedUpdate: () => {
        // At 10 fixed steps per second, each step moves one unit.
        simulated += 1;
        position.push(simulated);
      },
      update: (_frameDelta, alpha) => {
        smoothed.push(position.at(alpha));
        raw.push(position.current);
      }
    });
    source.run(Array.from({ length: 30 }, () => 1000 / 60));

    // Raw samples repeat six times per step; interpolation changes each frame.
    assert.ok(new Set(raw).size <= simulated + 1);
    assert.ok(new Set(smoothed).size > 4 * new Set(raw).size);
    // Interpolation stays behind the simulation value.
    assert.ok(smoothed.every((value) => value <= simulated));
    assert.ok(smoothed.every((value, index) => index === 0 ||
      value >= smoothed[index - 1]));
  });
});
