// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FrameScheduler } from "../src/index.ts";
import { scenarios } from "../fixtures/scenarios.ts";
import { replay, replayTape, closeTo } from "./helpers/replay.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

function stepsOf(
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
    });

    test("the first frame reports no elapsed time and renders", () => {
      const scheduler = new FrameScheduler();
      const schedule = scheduler.advance(1_000_000);

      assert.deepStrictEqual(schedule, {
        rawDelta: 0,
        frameDelta: 0,
        fixedDelta: kFixedDelta60,
        steps: 0,
        alpha: 0,
        render: true,
        clamped: false,
        panicked: false,
        droppedMs: 0
      });
    });

    test("a backwards timestamp yields a zero delta, never negative time", () => {
      const scheduler = new FrameScheduler();
      scheduler.advance(1000);
      const schedule = scheduler.advance(500);

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
      assert.strictEqual(schedules[0].steps, 12);
      assert.strictEqual(schedules[0].alpha, 0.5);
      assert.strictEqual(schedules[0].panicked, false);
      // `rawDelta` preserves the stall hidden by the clamp.
      assert.strictEqual(schedules[0].rawDelta, 10_000);
    });

    test("rawDelta is the unscaled, unclamped delta and is never negative", () => {
      const { schedules } = replay([40, 40], { timeScale: 0.5 });

      assert.deepStrictEqual(
        schedules.map(({ rawDelta }) => rawDelta),
        [40, 40]
      );
      assert.deepStrictEqual(
        schedules.map(({ frameDelta }) => frameDelta),
        [20, 20]
      );

      const scheduler = new FrameScheduler();
      scheduler.advance(1000);
      assert.strictEqual(scheduler.advance(500).rawDelta, 0);
    });

    test("caps the step loop and discards the remaining accumulator", () => {
      const { schedules, scheduler } = replay([200]);
      const [schedule] = schedules;

      assert.strictEqual(schedule.steps, 5);
      assert.strictEqual(schedule.panicked, true);
      assert.ok(closeTo(schedule.droppedMs, 200 - (5 * kFixedDelta60)));
      assert.strictEqual(schedule.alpha, 0);
      assert.strictEqual(scheduler.accumulator, 0);
      assert.ok(closeTo(scheduler.droppedTime, schedule.droppedMs));
    });

    test("dropped time is never carried into the next frame", () => {
      const { schedules } = replay([200, 20]);

      assert.strictEqual(schedules[1].steps, 1);
      assert.strictEqual(schedules[1].panicked, false);
      assert.strictEqual(schedules[1].droppedMs, 0);
    });

    test("clamped and panicked are independent", () => {
      const { schedules } = replay([5000], { maxStepsPerFrame: 100 });

      assert.strictEqual(schedules[0].clamped, true);
      assert.strictEqual(schedules[0].panicked, false);
    });
  });

  describe("render capping", () => {
    test("renders every frame when uncapped", () => {
      const { schedules } = replay(Array.from({ length: 8 }, () => 4));

      assert.ok(schedules.every(({ render }) => render));
    });

    test("a capped frame still accumulates simulation time", () => {
      const { schedules } = replay([8, 8], { maxFps: 30 });

      assert.strictEqual(schedules[0].render, false);
      assert.strictEqual(schedules[1].render, false);

      const { schedules: paced } = replay([25, 25, 25, 25], { maxFps: 30 });
      assert.deepStrictEqual(
        paced.map(({ render }) => render),
        [false, true, true, false]
      );
      assert.ok(paced.some(({ render, steps }) => render === false && steps > 0));
    });

    test("paces evenly instead of skipping every Nth frame", () => {
      const deltas = Array.from({ length: 12 }, () => 1000 / 144);
      const { schedules } = replay(deltas, { maxFps: 60 });
      const rendered = schedules.filter(({ render }) => render).length;

      // Twelve 144 Hz frames span ~83 ms; a 60 fps cap draws four.
      assert.strictEqual(rendered, 4);
      assert.deepStrictEqual(
        schedules.map(({ render }) => render).map(Number),
        [0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]
      );
    });

    test("keeps rendering while the simulation is paused", () => {
      const { schedules } = replay([16, 16, 16], { timeScale: 0 });

      assert.ok(schedules.every(({ render }) => render));
      assert.ok(schedules.every(({ steps }) => steps === 0));
    });
  });

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

    test("frameCount counts every advance", () => {
      const { scheduler } = replay([16, 16, 16]);

      assert.strictEqual(scheduler.frameCount, 4);
    });
  });

  describe("scenarios", () => {
    test("tabSwitch: the return frame clamps and panics, then recovers", () => {
      const { schedules } = replayTape(scenarios.tabSwitch);

      assert.deepStrictEqual(stepsOf(schedules), [1, 1, 0, 2, 5, 1, 1, 1, 1]);
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
      // A panic discards excess simulation time.
      assert.ok(scheduler.time < scheduler.elapsed);
    });

    test("singleSlowFrame: catches up within budget", () => {
      const { schedules, scheduler } = replayTape(scenarios.singleSlowFrame);

      assert.deepStrictEqual(stepsOf(schedules), [1, 1, 0, 2, 4, 1, 1, 1, 1]);
      assert.ok(schedules.every(({ panicked }) => panicked === false));
      assert.ok(schedules.every(({ clamped }) => clamped === false));
      assert.ok(closeTo(schedules[4].alpha, 0.8));
      assert.strictEqual(scheduler.droppedTime, 0);
    });

    test("highRefresh144: step-less frames are normal", () => {
      const { schedules } = replayTape(scenarios.highRefresh144);

      assert.ok(schedules.every(({ steps }) => steps <= 1));
      assert.ok(schedules.some(({ steps }) => steps === 0));
      assert.ok(schedules.every(({ render }) => render));
      assert.strictEqual(
        schedules.reduce((total, { steps }) => total + steps, 0),
        6
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
      assert.ok(schedules.every(({ alpha }) => alpha === 0));
      assert.ok(schedules.every(({ render }) => render));
      assert.strictEqual(scheduler.time, 0);
    });
  });
});
