// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GameLoop, ManualFrameSource } from "../src/index.ts";
import { record } from "./helpers/recorder.ts";

describe("Loop.GameLoop", () => {
  let source: ManualFrameSource;
  let loop: GameLoop;

  beforeEach(() => {
    source = new ManualFrameSource();
    loop = new GameLoop({ source });
  });

  describe("lifecycle", () => {
    test("start() and stop() drive the source and emit", () => {
      const events: string[] = [];
      loop.on("start", () => events.push("start"));
      loop.on("stop", () => events.push("stop"));

      assert.strictEqual(loop.running, false);
      loop.start();
      assert.strictEqual(loop.running, true);
      assert.strictEqual(source.running, true);

      loop.stop();
      assert.strictEqual(loop.running, false);
      assert.strictEqual(source.running, false);
      assert.deepStrictEqual(events, ["start", "stop"]);
    });

    test("start() twice throws, stop() twice is silent", () => {
      let stops = 0;
      loop.on("stop", () => {
        stops++;
      });

      loop.start();
      assert.throws(() => loop.start(), /already running/);

      loop.stop();
      loop.stop();
      assert.strictEqual(stops, 1);
    });

    test("start() resets the scheduler", () => {
      loop.start();
      source.step(200);
      assert.ok(loop.scheduler.time > 0);

      loop.stop();
      loop.start();

      assert.strictEqual(loop.scheduler.time, 0);
      assert.strictEqual(loop.scheduler.elapsed, 0);
      assert.strictEqual(loop.scheduler.frameCount, 1);
    });
  });

  describe("pause", () => {
    test("holds simulation time while rendering continues", () => {
      const { recorder, callbacks } = record();
      const states: boolean[] = [];
      loop.on("pause", ({ paused }) => states.push(paused));

      loop.start(callbacks);
      source.step(16);
      const simulated = loop.scheduler.time;

      loop.pause();
      source.run([16, 16, 16]);

      assert.strictEqual(loop.paused, true);
      assert.strictEqual(loop.scheduler.time, simulated);
      assert.ok(
        recorder.frames.slice(1).every(({ render }) => render)
      );
      assert.ok(
        recorder.frames.slice(1).every(({ steps }) => steps === 0)
      );

      loop.resume();
      source.step(20);

      assert.ok(loop.scheduler.time > simulated);
      assert.deepStrictEqual(states, [true, false]);
    });

    test("resuming does not replay the paused time", () => {
      loop.start();
      source.step(16);
      loop.pause();
      source.run([5000, 5000]);
      loop.resume();
      source.step(16);

      assert.ok(loop.scheduler.droppedTime === 0);
      assert.ok(loop.scheduler.elapsed < 40);
    });

    test("timeScale set while paused applies on resume", () => {
      loop.start();
      loop.pause();
      loop.timeScale = 0.5;

      assert.strictEqual(loop.timeScale, 0.5);
      assert.strictEqual(loop.scheduler.timeScale, 0);

      loop.resume();
      assert.strictEqual(loop.scheduler.timeScale, 0.5);
    });

    test("stop() clears the paused state", () => {
      loop.start();
      loop.pause();
      loop.stop();

      assert.strictEqual(loop.paused, false);
      assert.strictEqual(loop.scheduler.timeScale, 1);
    });
  });

  describe("events", () => {
    test("panic carries the dropped time", () => {
      const panics: { droppedMs: number; steps: number; }[] = [];
      loop.on("panic", (payload) => panics.push(payload));

      loop.start();
      source.step(200);

      assert.strictEqual(panics.length, 1);
      assert.strictEqual(panics[0].steps, 5);
      assert.ok(panics[0].droppedMs > 100);
    });

    test("clamp fires on a clamped frame, panic does not follow by itself", () => {
      const events: string[] = [];
      const clamps: { rawDelta: number; frameDelta: number; }[] = [];
      loop.scheduler.maxStepsPerFrame = 100;
      loop.on("clamp", (payload) => {
        events.push("clamp");
        clamps.push(payload);
      });
      loop.on("panic", () => events.push("panic"));

      loop.start();
      source.step(5000);

      assert.deepStrictEqual(events, ["clamp"]);
      assert.deepStrictEqual(
        clamps,
        [
          { rawDelta: 5000, frameDelta: 250 }
        ]
      );
    });
  });

  describe("configuration", () => {
    test("scheduler options are forwarded from the constructor", () => {
      const configured = new GameLoop({
        source: new ManualFrameSource(),
        fixedFps: 120,
        maxFps: 30
      });

      assert.strictEqual(
        configured.scheduler.fixedDelta,
        1000 / 120
      );
      assert.strictEqual(configured.scheduler.maxFps, 30);
      assert.strictEqual(configured.timeScale, 1);
    });

    test("a rejected timeScale leaves the mirror untouched", () => {
      loop.timeScale = 2;
      assert.throws(() => {
        loop.timeScale = -1;
      }, RangeError);

      assert.strictEqual(loop.timeScale, 2);
      assert.strictEqual(loop.scheduler.timeScale, 2);
    });
  });
});
