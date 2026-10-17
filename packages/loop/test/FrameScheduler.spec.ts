// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FrameScheduler } from "../src/index.ts";
import { replay, closeTo } from "./helpers/replay.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

function listSteps(
  schedules: { steps: number; }[]
): number[] {
  return schedules.map(({ steps }) => steps);
}

describe("Loop.FrameScheduler", () => {
  describe("defaults", () => {
    test("exposes the documented defaults", () => {
      const scheduler = new FrameScheduler();

      assert.strictEqual(scheduler.fixedFps, 60);
      assert.strictEqual(scheduler.fixedDelta, kFixedDelta60);
      assert.strictEqual(scheduler.maxFps, Infinity);
      assert.strictEqual(scheduler.maxFrameDelta, 250);
      assert.strictEqual(scheduler.maxStepsPerFrame, 5);
      assert.strictEqual(scheduler.timeScale, 1);
      assert.strictEqual(scheduler.snapTolerance, 0);
      assert.strictEqual(scheduler.refreshPeriod, null);
    });

    test("the first frame reports no elapsed time, renders, and starts half a step in", () => {
      const scheduler = new FrameScheduler();
      const schedule = scheduler.advance(1_000_000);

      assert.deepStrictEqual(schedule, {
        rawDelta: 0,
        unscaledDelta: 0,
        frameDelta: 0,
        renderDelta: 0,
        unscaledRenderDelta: 0,
        fixedDelta: kFixedDelta60,
        steps: 0,
        alpha: 0.5,
        render: true,
        clamped: false,
        snapped: false,
        panicked: false,
        droppedMs: 0
      });
      assert.strictEqual(scheduler.elapsed, 0);
      assert.strictEqual(scheduler.phaseShift, kFixedDelta60 / 2);
    });

    test("a backwards timestamp yields a zero delta, never negative time", () => {
      const scheduler = new FrameScheduler();
      scheduler.advance(1000);
      const schedule = scheduler.advance(500);

      assert.strictEqual(schedule.rawDelta, 0);
      assert.strictEqual(schedule.frameDelta, 0);
      assert.strictEqual(schedule.steps, 0);
      assert.strictEqual(scheduler.elapsed, 0);
    });
  });

  describe("options", () => {
    test("fixedFps drives fixedDelta", () => {
      const scheduler = new FrameScheduler({ fixedFps: 10 });
      assert.strictEqual(scheduler.fixedDelta, 100);

      scheduler.fixedFps = 50;
      assert.strictEqual(scheduler.fixedDelta, 20);
    });

    test("rejects out of range values", () => {
      assert.throws(() => new FrameScheduler({ fixedFps: 0 }), RangeError);
      assert.throws(() => new FrameScheduler({ fixedFps: Infinity }), RangeError);
      assert.throws(() => new FrameScheduler({ maxFps: -1 }), RangeError);
      assert.throws(() => new FrameScheduler({ maxFrameDelta: NaN }), RangeError);
      assert.throws(() => new FrameScheduler({ maxStepsPerFrame: 0 }), RangeError);
      assert.throws(() => new FrameScheduler({ maxStepsPerFrame: 1.5 }), RangeError);
      assert.throws(() => new FrameScheduler({ timeScale: -0.5 }), RangeError);
      assert.throws(() => new FrameScheduler({ snapTolerance: -1 }), RangeError);
      assert.throws(() => new FrameScheduler({ snapTolerance: Infinity }), RangeError);
      assert.doesNotThrow(() => new FrameScheduler({ maxFps: Infinity }));
      assert.doesNotThrow(() => new FrameScheduler({ timeScale: 0 }));
    });

    test("timeScale multiplies the frame delta before accumulating", () => {
      const { schedules, scheduler } = replay([100, 100], { timeScale: 0.5 });

      assert.strictEqual(schedules[0].frameDelta, 50);
      assert.strictEqual(schedules[0].steps, 3);
      assert.strictEqual(scheduler.elapsed, 100);
    });
  });

  describe("lag policy", () => {
    test("clamps the raw delta to maxFrameDelta", () => {
      const { schedules } = replay([10_000], {
        fixedFps: 50,
        maxStepsPerFrame: 100
      });

      assert.strictEqual(schedules[0].clamped, true);
      assert.strictEqual(schedules[0].frameDelta, 250);
      assert.strictEqual(schedules[0].steps, 13);
      assert.strictEqual(schedules[0].alpha, 0);
      assert.strictEqual(schedules[0].panicked, false);
      assert.strictEqual(schedules[0].rawDelta, 10_000);
      assert.strictEqual(schedules[0].unscaledDelta, 250);
    });

    test("rawDelta and unscaledDelta ignore timeScale", () => {
      const { schedules } = replay([40, 40], { timeScale: 0.5 });

      assert.deepStrictEqual(
        schedules.map(({ rawDelta }) => rawDelta),
        [40, 40]
      );
      assert.deepStrictEqual(
        schedules.map(({ unscaledDelta }) => unscaledDelta),
        [40, 40]
      );
      assert.deepStrictEqual(
        schedules.map(({ frameDelta }) => frameDelta),
        [20, 20]
      );
    });

    test("caps the step loop and discards the accumulator beyond half a step", () => {
      const { schedules, scheduler } = replay([200]);
      const [schedule] = schedules;

      assert.strictEqual(schedule.steps, 5);
      assert.strictEqual(schedule.panicked, true);
      assert.ok(closeTo(schedule.droppedMs, 200 - (5 * kFixedDelta60)));
      assert.ok(closeTo(schedule.alpha, 0.5));
      assert.ok(closeTo(scheduler.accumulator, kFixedDelta60 / 2));
      assert.ok(closeTo(scheduler.droppedTime, schedule.droppedMs));
    });

    test("the step budget grows with a timeScale above 1", () => {
      const { schedules } = replay([20, 20], {
        fixedFps: 50,
        timeScale: 8
      });

      assert.deepStrictEqual(listSteps(schedules), [8, 8]);
      assert.ok(schedules.every(({ panicked }) => !panicked));
    });

    test("fast-forward still panics past the scaled budget", () => {
      const { schedules } = replay([100], {
        timeScale: 2,
        maxStepsPerFrame: 2
      });

      assert.strictEqual(schedules[0].steps, 4);
      assert.strictEqual(schedules[0].panicked, true);
    });

    test("a timeScale below 1 keeps maxStepsPerFrame", () => {
      const { schedules } = replay([200], { timeScale: 0.5 });

      assert.strictEqual(schedules[0].steps, 5);
      assert.strictEqual(schedules[0].panicked, true);
    });

    test("dropped time is never carried into the next frame", () => {
      const { schedules } = replay([200, 20]);

      assert.strictEqual(schedules[1].steps, 1);
      assert.strictEqual(schedules[1].panicked, false);
      assert.strictEqual(schedules[1].droppedMs, 0);
    });
  });

  describe("render capping", () => {
    test("paces evenly instead of skipping every Nth frame", () => {
      const deltas = Array.from({ length: 11 }, () => 1000 / 144);
      const { schedules } = replay(deltas, { maxFps: 60 });

      assert.deepStrictEqual(
        schedules.map(({ render }) => render).map(Number),
        [0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]
      );
    });

    test("a cap at the display rate renders every jittery frame", () => {
      const deltas = Array.from(
        { length: 600 },
        (_, index) => (index % 2 === 0 ? 16.6 : 16.733)
      );
      const { schedules } = replay(deltas, { maxFps: 60 });

      assert.ok(schedules.every(({ render }) => render));
    });

    test("renderDelta carries the time of skipped frames", () => {
      const deltas = Array.from({ length: 11 }, () => 1000 / 144);
      const { schedules } = replay(deltas, { maxFps: 60 });

      const rendered = schedules
        .map(({ render, renderDelta }) => (render ? renderDelta : null))
        .filter((delta) => delta !== null);
      assert.ok(closeTo(rendered[0], 2000 / 144));
      assert.ok(closeTo(rendered[1], 3000 / 144));
      assert.ok(closeTo(schedules[0].renderDelta, 1000 / 144));
    });

    test("unscaledRenderDelta ignores timeScale", () => {
      const { schedules } = replay(
        [20, 20],
        {
          maxFps: 30,
          timeScale: 0.5
        }
      );

      assert.strictEqual(schedules[1].renderDelta, 20);
      assert.strictEqual(schedules[1].unscaledRenderDelta, 40);
    });

    test("a frame after skipGap() does not deliver time owed before it", () => {
      const scheduler = new FrameScheduler({ maxFps: 30 });
      scheduler.advance(0);
      scheduler.advance(20);

      scheduler.skipGap();
      const schedule = scheduler.advance(5000);

      assert.strictEqual(schedule.render, true);
      assert.strictEqual(schedule.renderDelta, 0);
      assert.strictEqual(schedule.unscaledRenderDelta, 0);
    });
  });
});
