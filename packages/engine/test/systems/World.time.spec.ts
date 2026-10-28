// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { World } from "../../src/systems/World.ts";
import {
  createWorldHarness,
  type WorldHarness
} from "../helpers/world/worldHarness.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

describe("Systems.World", () => {
  let world: World;
  let sceneManager: WorldHarness["sceneManager"];
  let renderer: WorldHarness["renderer"];
  let input: WorldHarness["input"];
  let scheduler: WorldHarness["scheduler"];
  let tick: WorldHarness["tick"];

  beforeEach(() => {
    ({ world, sceneManager, renderer, input, scheduler, tick } = createWorldHarness());
  });

  describe("time", () => {
    test("should split game and wall-clock time in seconds", () => {
      scheduler.timeScale = 0.5;
      world.start();
      tick();

      tick(40);

      assert.strictEqual(world.time.delta, 0.02);
      assert.strictEqual(world.time.unscaledDelta, 0.04);
      assert.strictEqual(world.time.elapsed, 0.02);
      assert.strictEqual(world.time.unscaledElapsed, 0.04);
    });

    test("should keep wall-clock time flowing at a zero time scale", () => {
      scheduler.timeScale = 0;
      world.start();
      tick();

      tick(20);
      tick(20);

      assert.strictEqual(world.time.delta, 0);
      assert.strictEqual(world.time.elapsed, 0);
      assert.strictEqual(world.time.unscaledDelta, 0.02);
      assert.strictEqual(world.time.unscaledElapsed, 0.04);
    });

    test("should clamp wall-clock time like game time", () => {
      world.start();
      tick();

      tick(10_000);

      assert.strictEqual(world.time.unscaledDelta, 0.25);
    });

    test("should carry frames skipped by the render cap into the next delta", () => {
      scheduler.maxFps = 30;
      world.start();
      tick();

      tick(20);
      tick(20);

      assert.strictEqual(world.time.delta, 0.04);
      assert.strictEqual(world.time.unscaledDelta, 0.04);
      assert.strictEqual(world.time.elapsed, 0.04);
      assert.strictEqual(world.time.unscaledElapsed, 0.04);
    });

    test("should expose the delta read by update()", () => {
      const deltas: number[] = [];
      sceneManager.update.mock.mockImplementation(() => {
        deltas.push(world.time.delta);
      });
      world.start();
      tick();

      tick(20);

      assert.deepStrictEqual(deltas, [0, 0.02]);
    });

    test("should advance fixedElapsed once per completed step", () => {
      const seen: number[] = [];
      sceneManager.fixedUpdate.mock.mockImplementation(() => {
        seen.push(world.time.fixedElapsed);
      });
      world.start();
      tick();

      tick(3 * kFixedDelta60);

      assert.deepStrictEqual(seen, [
        0,
        kFixedDelta60 / 1000,
        2 * kFixedDelta60 / 1000
      ]);
      assert.strictEqual(world.time.fixedElapsed, 3 * kFixedDelta60 / 1000);
    });
  });

  describe("start() / stop()", () => {
    test("should gate ticking", () => {
      world.start();
      assert.strictEqual(world.running, true);
      tick(20);
      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);

      world.stop();
      assert.strictEqual(world.running, false);
      tick(20);
      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);
    });
  });

  describe("dispose()", () => {
    test("should release the renderer, which owns the WebGL context", () => {
      world.dispose();

      assert.strictEqual(renderer.dispose.mock.callCount(), 1);
    });

    test("should disconnect before releasing the renderer", () => {
      world.connect();

      world.dispose();

      assert.strictEqual(input.disconnect.mock.callCount(), 1);
      assert.strictEqual(renderer.unobserveResize.mock.callCount(), 1);
    });

    test("should stop the loop", () => {
      world.start();

      world.dispose();
      tick(20);

      assert.strictEqual(
        sceneManager.update.mock.callCount(),
        0,
        "a stopped loop must not keep driving the scene"
      );
    });
  });

  describe("scheduling", () => {
    test("should not advance a scheduler of its own", () => {
      world.start();
      const schedule = scheduler.advance(0);
      world.tick(schedule);
      world.tick(schedule);

      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 2);
      assert.strictEqual(scheduler.frameCount, 1);
    });
  });
});
