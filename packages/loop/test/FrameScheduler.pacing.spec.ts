// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FrameScheduler } from "../src/index.ts";
import { replay } from "./helpers/replay.ts";
import { Xorshift32, jitteredDeltas } from "./helpers/prng.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;
const kWarmupFrames = 8;
const kSnapTolerance = 2;

function stepsOf(
  schedules: { steps: number; }[]
): number[] {
  return schedules.map(({ steps }) => steps);
}

describe("Loop.FrameScheduler pacing", () => {
  function jittered(
    hz: number,
    jitter = 0.75,
    frames = 3600
  ): number[] {
    return jitteredDeltas(new Xorshift32(42), 1000 / hz, jitter, frames);
  }

  function steadySteps(
    schedules: { steps: number; }[]
  ): number[] {
    return stepsOf(schedules.slice(kWarmupFrames));
  }

  function alternates(
    steps: number[]
  ): boolean {
    return steps.slice(1).every((count, index) => count + steps[index] === 1);
  }

  test("a jittery display at the step rate runs one step every frame", () => {
    const { schedules } = replay(jittered(60));

    assert.ok(schedules.every(({ steps }) => steps === 1));
    assert.ok(schedules.every(({ snapped }) => !snapped));
  });

  test("refreshPeriod measures the display cadence through missed frames", () => {
    const deltas = jittered(60, 0.5, 64)
      .map((delta, index) => (index % 5 === 0 ? delta * 2 : delta));
    const { scheduler } = replay(deltas);

    assert.ok(Math.abs(scheduler.refreshPeriod! - kFixedDelta60) < 0.2);
  });

  test("refreshPeriod follows the display to another refresh rate", () => {
    const scheduler = new FrameScheduler();
    let now = 0;
    scheduler.advance(now);

    const periods = [120, 60, 144].map((hz) => {
      for (const delta of jittered(hz, 0.5, 64)) {
        now += delta;
        scheduler.advance(now);
      }

      return scheduler.refreshPeriod!;
    });

    for (const [index, hz] of [120, 60, 144].entries()) {
      assert.ok(
        Math.abs(periods[index] - (1000 / hz)) < 0.1,
        `${hz}Hz measured as ${periods[index]}ms`
      );
    }
  });

  test("snapping locks a 59.94Hz display to one step per frame", () => {
    const { schedules } = replay(jittered(59.94), { snapTolerance: kSnapTolerance });

    const steady = schedules.slice(kWarmupFrames);

    assert.ok(steady.every(({ steps }) => steps === 1));
    assert.ok(steady.every(({ snapped }) => snapped));
    assert.ok(steady.every(({ unscaledDelta }) => unscaledDelta === kFixedDelta60));
  });

  test("snapping turns a missed refresh into exactly two steps", () => {
    const deltas = jittered(60, 0.75, 32);
    deltas[20] += 1000 / 60;
    const { schedules } = replay(deltas, { snapTolerance: kSnapTolerance });

    assert.strictEqual(schedules[20].unscaledDelta, 2 * kFixedDelta60);
    assert.deepStrictEqual(
      stepsOf(schedules.slice(kWarmupFrames)),
      schedules.slice(kWarmupFrames).map((_, index) => (index === 12 ? 2 : 1))
    );
  });

  test("snapping alternates steps on a display twice the step rate", () => {
    const { schedules } = replay(jittered(120), { snapTolerance: kSnapTolerance });

    assert.ok(alternates(steadySteps(schedules)));
  });

  test("snapping alternates steps at half speed on a display at the step rate", () => {
    const { schedules } = replay(jittered(60), {
      snapTolerance: kSnapTolerance,
      timeScale: 0.5
    });

    assert.ok(alternates(steadySteps(schedules)));
  });

  test("a delta away from whole refresh periods is not snapped", () => {
    const deltas = jittered(60, 0.5, 16);
    deltas[12] = 25;
    const { schedules } = replay(deltas, { snapTolerance: kSnapTolerance });

    assert.strictEqual(schedules[12].snapped, false);
    assert.strictEqual(schedules[12].unscaledDelta, 25);
    assert.strictEqual(schedules[13].snapped, true);
  });
});
