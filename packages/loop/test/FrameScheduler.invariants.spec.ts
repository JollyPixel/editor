// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FrameScheduler,
  type FrameSchedulerOptions
} from "../src/index.ts";
import { Xorshift32, generateTape } from "./helpers/prng.ts";

// CONSTANTS
const kSeeds = 64;
const kFramesPerTape = 200;
// Allow floating-point error in time bookkeeping.
const kEpsilon = 1e-9;

const kOptionGrid: FrameSchedulerOptions[] = [
  {},
  { fixedFps: 30 },
  { fixedFps: 120, maxStepsPerFrame: 10 },
  { fixedFps: 10, maxStepsPerFrame: 1 },
  { maxFps: 30 },
  { maxFps: 144, maxFrameDelta: 100 },
  { maxFrameDelta: 33, maxStepsPerFrame: 2 },
  { timeScale: 0.25 },
  { timeScale: 4, fixedFps: 90 },
  { timeScale: 0 }
];

function describeOptions(
  options: FrameSchedulerOptions
): string {
  const entries = Object.entries(options);

  return entries.length === 0 ?
    "defaults" :
    entries.map(([key, value]) => `${key}=${value}`).join(" ");
}

describe("Loop.FrameScheduler invariants", () => {
  for (const options of kOptionGrid) {
    test(`hold over generated tapes (${describeOptions(options)})`, () => {
      for (let seed = 1; seed <= kSeeds; seed++) {
        const rng = new Xorshift32(seed);
        const deltas = generateTape(rng, { frames: kFramesPerTape });
        const scheduler = new FrameScheduler(options);
        const maxSteps = scheduler.maxStepsPerFrame;

        let now = 0;
        let previousTime = 0;
        scheduler.advance(now);

        for (const [index, delta] of deltas.entries()) {
          now += delta;
          const schedule = scheduler.advance(now);
          const where = `seed ${seed}, frame ${index}`;

          for (const [key, value] of Object.entries(schedule)) {
            assert.ok(
              typeof value !== "number" || Number.isFinite(value),
              `${where}: ${key} is not finite (${value})`
            );
          }

          assert.ok(
            schedule.steps <= maxSteps,
            `${where}: ${schedule.steps} steps exceed the budget of ${maxSteps}`
          );
          assert.ok(
            Number.isInteger(schedule.steps) && schedule.steps >= 0,
            `${where}: steps is not a positive integer (${schedule.steps})`
          );
          assert.ok(
            schedule.alpha >= 0 && schedule.alpha < 1,
            `${where}: alpha out of [0, 1) (${schedule.alpha})`
          );
          assert.ok(
            schedule.panicked || scheduler.accumulator < scheduler.fixedDelta,
            `${where}: accumulator ${scheduler.accumulator} >= fixedDelta ` +
            `${scheduler.fixedDelta} without a panic`
          );
          assert.ok(
            schedule.panicked ? schedule.droppedMs > 0 : schedule.droppedMs === 0,
            `${where}: droppedMs ${schedule.droppedMs} disagrees with panicked`
          );
          assert.ok(
            scheduler.time >= previousTime,
            `${where}: simulation time went backwards`
          );
          previousTime = scheduler.time;

          // Account for simulated, pending, and dropped time.
          const accounted = scheduler.time +
            scheduler.accumulator +
            scheduler.droppedTime;
          assert.ok(
            Math.abs(scheduler.elapsed - accounted) <= kEpsilon,
            `${where}: ${scheduler.elapsed}ms of wall time, ${accounted}ms ` +
            "accounted for"
          );
        }
      }
    });
  }

  test("the generator is deterministic across runs", () => {
    const first = generateTape(new Xorshift32(7));
    const second = generateTape(new Xorshift32(7));

    assert.deepStrictEqual(first, second);
    assert.notDeepStrictEqual(first, generateTape(new Xorshift32(8)));
    assert.ok(first.every((delta) => Number.isFinite(delta) && delta >= 0));
  });
});
