// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FrameRateGovernor,
  FrameScheduler,
  type FrameRateGovernorOptions,
  type FrameSchedulerOptions
} from "../src/index.ts";

// CONSTANTS
const kFrame = 1000 / 60;
const kFrameTolerance = 2 * kFrame;

interface Change {
  at: number;
  halved: boolean;
  maxFps: number;
}

function frames(
  durationMs: number,
  missEvery = 0
): number[] {
  const deltas: number[] = [];
  let elapsed = 0;
  while (elapsed < durationMs) {
    const missed = missEvery > 0 && (deltas.length + 1) % missEvery === 0;
    const delta = missed ? 2 * kFrame : kFrame;
    deltas.push(delta);
    elapsed += delta;
  }

  return deltas;
}

function harness(
  options: FrameRateGovernorOptions = {},
  schedulerOptions: FrameSchedulerOptions = {}
) {
  const scheduler = new FrameScheduler(schedulerOptions);
  const governor = new FrameRateGovernor(scheduler, options);
  const changes: Change[] = [];
  let now = 0;

  governor.on("change", (payload) => changes.push({ at: now, ...payload }));
  governor.observe(scheduler.advance(now));

  function play(
    deltas: number[]
  ): void {
    for (const delta of deltas) {
      now += delta;
      governor.observe(scheduler.advance(now));
    }
  }

  return {
    scheduler,
    governor,
    changes,
    play
  };
}

describe("Loop.FrameRateGovernor", () => {
  test("halves the render rate when a quarter of rendered frames miss", () => {
    const { scheduler, governor, changes, play } = harness();

    play(frames(2300, 3));

    assert.strictEqual(governor.halved, true);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].halved, true);
    assert.ok(Math.abs(changes[0].maxFps - 30) < 0.1);
    assert.strictEqual(scheduler.maxFps, changes[0].maxFps);
  });

  test("keeps the full rate through an isolated hitch", () => {
    const { governor, changes, play } = harness();

    play([
      ...frames(1000),
      200,
      ...frames(3000)
    ]);

    assert.strictEqual(governor.halved, false);
    assert.deepStrictEqual(changes, []);
  });

  test("retries the full rate after retryDelay", () => {
    const { scheduler, changes, play } = harness({}, { maxFps: 144 });

    play(frames(2300, 3));
    play(frames(6000));

    assert.deepStrictEqual(
      changes.map(({ halved, maxFps }) => [halved, Math.round(maxFps)]),
      [[true, 30], [false, 144]]
    );
    assert.ok(Math.abs(changes[1].at - changes[0].at - 5000) <= kFrameTolerance);
    assert.strictEqual(scheduler.maxFps, 144);
  });

  test("each failed retry doubles the wait up to maxRetryDelay", () => {
    const { changes, play } = harness({
      retryDelay: 2000,
      maxRetryDelay: 5000
    });

    play(frames(20_000, 3));

    const waits = [0, 2, 4].map((index) => changes[index + 1].at - changes[index].at);
    assert.deepStrictEqual(
      changes.slice(0, 6).map(({ halved }) => halved),
      [true, false, true, false, true, false]
    );
    for (const [index, expected] of [2000, 4000, 5000].entries()) {
      assert.ok(
        Math.abs(waits[index] - expected) <= kFrameTolerance,
        `wait ${index} was ${waits[index]}ms`
      );
    }
  });

  test("a retry that holds the full rate resets the wait", () => {
    const { changes, play } = harness({ retryDelay: 2000 });

    play(frames(2300, 3));
    play(frames(4500));
    play(frames(4300, 3));
    play(frames(2500));

    assert.deepStrictEqual(
      changes.map(({ halved }) => halved),
      [true, false, true, false]
    );
    assert.ok(Math.abs(changes[3].at - changes[2].at - 2000) <= kFrameTolerance);
  });

  test("leaves a cap already at half the refresh rate alone", () => {
    const { scheduler, changes, play } = harness({}, { maxFps: 30 });

    play(frames(6000, 2));

    assert.deepStrictEqual(changes, []);
    assert.strictEqual(scheduler.maxFps, 30);
  });

  test("reset() restores the cap it replaced", () => {
    const { scheduler, governor, play } = harness({}, { maxFps: 144 });
    play(frames(2300, 3));

    governor.reset();

    assert.strictEqual(governor.halved, false);
    assert.strictEqual(scheduler.maxFps, 144);
  });

  test("rejects out of range options", () => {
    const scheduler = new FrameScheduler();

    assert.throws(() => new FrameRateGovernor(scheduler, { missRatio: 0 }), RangeError);
    assert.throws(() => new FrameRateGovernor(scheduler, { missRatio: 1.5 }), RangeError);
    assert.throws(() => new FrameRateGovernor(scheduler, { window: 0 }), RangeError);
    assert.throws(() => new FrameRateGovernor(scheduler, { retryDelay: Infinity }), RangeError);
    assert.throws(
      () => new FrameRateGovernor(scheduler, {
        retryDelay: 5000,
        maxRetryDelay: 1000
      }),
      RangeError
    );
  });
});
