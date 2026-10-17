// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FrameScheduler } from "../src/index.ts";
import { scenarios } from "../fixtures/scenarios.ts";
import {
  replay,
  replayTape,
  closeTo
} from "./helpers/replay.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

function listSteps(
  schedules: { steps: number; }[]
): number[] {
  return schedules.map(({ steps }) => steps);
}

describe("Loop.FrameScheduler", () => {
  describe("state", () => {
    test("reset() clears every accumulated value", () => {
      const { scheduler } = replay([200, 200]);
      assert.ok(scheduler.droppedTime > 0);

      scheduler.reset();

      assert.strictEqual(scheduler.time, 0);
      assert.strictEqual(scheduler.elapsed, 0);
      assert.strictEqual(scheduler.accumulator, 0);
      assert.strictEqual(scheduler.droppedTime, 0);
      assert.strictEqual(scheduler.frameCount, 0);
      assert.strictEqual(scheduler.advance(9999).frameDelta, 0);
    });

    test("skipGap() reports a zero delta next, keeping simulation time", () => {
      const scheduler = new FrameScheduler({ maxFps: 30 });
      scheduler.advance(0);
      scheduler.advance(40);
      const time = scheduler.time;

      scheduler.skipGap();
      const schedule = scheduler.advance(10_000);

      assert.strictEqual(schedule.rawDelta, 0);
      assert.strictEqual(schedule.clamped, false);
      assert.strictEqual(schedule.render, true);
      assert.strictEqual(scheduler.time, time);
      assert.strictEqual(scheduler.advance(10_016).rawDelta, 16);
    });

    test("queueSteps() adds steps to the next frame only", () => {
      const scheduler = new FrameScheduler({
        timeScale: 0,
        maxFps: 30
      });
      scheduler.advance(0);

      scheduler.queueSteps(2);
      const queued = scheduler.advance(5);
      const next = scheduler.advance(10);

      assert.strictEqual(queued.steps, 2);
      assert.strictEqual(queued.frameDelta, 2 * kFixedDelta60);
      assert.strictEqual(queued.unscaledDelta, 5);
      assert.strictEqual(queued.render, true);
      assert.strictEqual(next.steps, 0);
      assert.strictEqual(next.frameDelta, 0);
      assert.strictEqual(scheduler.time, 2 * kFixedDelta60);
      assert.strictEqual(scheduler.elapsed, 2 * kFixedDelta60);
    });

    test("queueSteps() bypasses maxStepsPerFrame and keeps the accumulator", () => {
      const scheduler = new FrameScheduler({ maxStepsPerFrame: 1 });
      scheduler.advance(0);

      scheduler.queueSteps(3);
      const schedule = scheduler.advance(20);

      assert.strictEqual(schedule.steps, 4);
      assert.strictEqual(schedule.panicked, false);
      assert.ok(closeTo(scheduler.accumulator, 20 - (kFixedDelta60 / 2)));
      assert.ok(closeTo(
        scheduler.elapsed + scheduler.phaseShift,
        scheduler.time + scheduler.accumulator + scheduler.droppedTime
      ));
    });

    test("queueSteps() rejects a count below one or fractional", () => {
      const scheduler = new FrameScheduler();

      assert.throws(() => scheduler.queueSteps(0), RangeError);
      assert.throws(() => scheduler.queueSteps(1.5), RangeError);
    });

    test("reset() drops queued steps", () => {
      const scheduler = new FrameScheduler();
      scheduler.queueSteps(2);

      scheduler.reset();

      assert.strictEqual(scheduler.advance(0).steps, 0);
    });

    test("frameCount counts every advance", () => {
      const { scheduler } = replay([16, 16, 16]);

      assert.strictEqual(scheduler.frameCount, 4);
    });
  });

  describe("scenarios", () => {
    test("tabSwitch: the return frame clamps and panics, then recovers", () => {
      const { schedules } = replayTape(scenarios.tabSwitch);

      assert.deepStrictEqual(listSteps(schedules), [1, 1, 1, 1, 5, 1, 1, 1, 1]);
      assert.deepStrictEqual(
        schedules.map(({ clamped }) => clamped),
        [false, false, false, false, true, false, false, false, false]
      );
      assert.deepStrictEqual(
        schedules.map(({ panicked }) => panicked),
        [false, false, false, false, true, false, false, false, false]
      );
      assert.ok(closeTo(schedules[4].droppedMs, 250 - (5 * kFixedDelta60)));
    });

    test("sustainedOverload: every frame panics, drop time climbs", () => {
      const { schedules, scheduler } = replayTape(scenarios.sustainedOverload);

      assert.ok(schedules.every(({ steps }) => steps === 5));
      assert.ok(schedules.every(({ panicked }) => panicked));
      assert.ok(schedules.every(({ clamped }) => clamped === false));
      assert.ok(schedules.every(({ render }) => render));
      assert.ok(closeTo(scheduler.droppedTime, 10 * (200 - (5 * kFixedDelta60))));
      assert.ok(scheduler.time < scheduler.elapsed);
    });

    test("singleSlowFrame: catches up within budget", () => {
      const { schedules, scheduler } = replayTape(scenarios.singleSlowFrame);

      assert.deepStrictEqual(listSteps(schedules), [1, 1, 1, 1, 5, 1, 1, 1, 1]);
      assert.ok(schedules.every(({ panicked }) => panicked === false));
      assert.ok(schedules.every(({ clamped }) => clamped === false));
      assert.ok(closeTo(schedules[4].alpha, 0.3));
      assert.strictEqual(scheduler.droppedTime, 0);
    });

    test("highRefresh144: step-less frames are normal", () => {
      const { schedules } = replayTape(scenarios.highRefresh144);

      assert.ok(schedules.every(({ steps }) => steps <= 1));
      assert.ok(schedules.some(({ steps }) => steps === 0));
      assert.ok(schedules.every(({ render }) => render));
      assert.strictEqual(
        schedules.reduce((total, { steps }) => total + steps, 0),
        7
      );
    });

    test("fixedFasterThanRender: undrawn frames still simulate", () => {
      const { schedules } = replayTape(scenarios.fixedFasterThanRender);

      assert.ok(schedules.every(({ fixedDelta }) => fixedDelta === 1000 / 120));
      const undrawn = schedules.filter(({ render }) => render === false);
      assert.ok(undrawn.length > 0);
      assert.ok(undrawn.every(({ steps }) => steps > 0));
      assert.ok(schedules.every(({ panicked }) => panicked === false));
    });

    test("timeScaleZero: no simulation, uninterrupted rendering", () => {
      const { schedules, scheduler } = replayTape(scenarios.timeScaleZero);

      assert.ok(schedules.every(({ frameDelta }) => frameDelta === 0));
      assert.ok(schedules.every(({ steps }) => steps === 0));
      assert.ok(schedules.every(({ alpha }) => alpha === 0.5));
      assert.ok(schedules.every(({ render }) => render));
      assert.strictEqual(scheduler.time, 0);
    });
  });
});
