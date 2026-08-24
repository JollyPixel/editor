// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GameLoop,
  ManualFrameSource,
  type FrameSchedule
} from "../src/index.ts";
import { scenarios } from "../fixtures/scenarios.ts";
import { replayTape } from "./helpers/replay.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

interface Recorder {
  fixedUpdate: [number, number][];
  update: [number, number][];
  frames: FrameSchedule[];
  timestamps: number[];
}

function record(): {
  recorder: Recorder;
  callbacks: {
    fixedUpdate: (delta: number, stepIndex: number) => void;
    update: (delta: number, alpha: number) => void;
    frame: (schedule: FrameSchedule, now: number) => void;
  };
} {
  const recorder: Recorder = {
    fixedUpdate: [],
    update: [],
    frames: [],
    timestamps: []
  };

  return {
    recorder,
    callbacks: {
      fixedUpdate: (delta, stepIndex) => {
        recorder.fixedUpdate.push([delta, stepIndex]);
      },
      update: (delta, alpha) => {
        recorder.update.push([delta, alpha]);
      },
      frame: (schedule, now) => {
        recorder.frames.push(schedule);
        recorder.timestamps.push(now);
      }
    }
  };
}

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
      // `start()` emits only the priming frame.
      assert.strictEqual(loop.scheduler.frameCount, 1);
    });

    test("a stopped loop receives no frame", () => {
      const { recorder, callbacks } = record();
      loop.start(callbacks);
      source.step(16);
      loop.stop();

      assert.throws(() => source.step(16), /while stopped/);
      // One priming frame plus one stepped frame.
      assert.strictEqual(recorder.frames.length, 2);
    });
  });

  describe("callbacks", () => {
    test("fixedUpdate receives the fixed delta and an incrementing stepIndex", () => {
      const { recorder, callbacks } = record();
      loop.start(callbacks);
      // 80 ms covers four 16.66 ms steps.
      source.step(80);

      assert.deepStrictEqual(recorder.fixedUpdate, [
        [kFixedDelta60, 0],
        [kFixedDelta60, 1],
        [kFixedDelta60, 2],
        [kFixedDelta60, 3]
      ]);
      assert.strictEqual(recorder.update.length, 2);
      assert.deepStrictEqual(recorder.update[1], [80, recorder.frames[1].alpha]);
    });

    test("stepIndex restarts at zero on every frame", () => {
      const { recorder, callbacks } = record();
      loop.start(callbacks);
      source.step(40);
      source.step(40);

      const indexes = recorder.fixedUpdate.map(([, stepIndex]) => stepIndex);
      assert.deepStrictEqual(indexes, [0, 1, 0, 1]);
    });

    test("a frame the render cap suppressed skips update but not fixedUpdate", () => {
      const { recorder, callbacks } = record();
      loop.scheduler.maxFps = 30;
      loop.start(callbacks);
      source.step(20);

      assert.strictEqual(recorder.frames[1].render, false);
      assert.strictEqual(recorder.fixedUpdate.length, 1);
      assert.strictEqual(recorder.update.length, 1);
    });

    test("frame carries the source timestamp", () => {
      const { recorder, callbacks } = record();
      loop.start(callbacks);
      source.step(16);
      source.step(4);

      assert.deepStrictEqual(recorder.timestamps, [0, 16, 20]);
    });

    test("frame runs once per frame, drawn or not", () => {
      const { recorder, callbacks } = record();
      loop.scheduler.maxFps = 30;
      loop.start(callbacks);
      source.run([16, 16, 16, 16]);

      assert.strictEqual(recorder.frames.length, 5);
      assert.ok(recorder.frames.some(({ render }) => render === false));
    });

    test("starting without callbacks is not an error", () => {
      loop.start();

      assert.doesNotThrow(() => source.step(200));
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
      assert.ok(recorder.frames.slice(1).every(({ render }) => render));
      assert.ok(recorder.frames.slice(1).every(({ steps }) => steps === 0));

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
      // Preserve the raw stall alongside the capped delta.
      assert.deepStrictEqual(clamps, [{ rawDelta: 5000, frameDelta: 250 }]);
    });
  });

  describe("configuration", () => {
    test("scheduling is configured on the scheduler, timeScale on the loop", () => {
      loop.scheduler.fixedFps = 30;
      loop.scheduler.maxFrameDelta = 100;
      loop.timeScale = 2;

      assert.strictEqual(loop.scheduler.fixedFps, 30);
      assert.strictEqual(loop.scheduler.maxFrameDelta, 100);
      assert.strictEqual(loop.scheduler.timeScale, 2);
      assert.strictEqual(loop.timeScale, 2);
    });

    test("scheduler options are forwarded from the constructor", () => {
      const configured = new GameLoop({
        source: new ManualFrameSource(),
        fixedFps: 120,
        maxFps: 30
      });

      assert.strictEqual(configured.scheduler.fixedDelta, 1000 / 120);
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

    test("callbacks survive a stop/start cycle unless replaced", () => {
      const { recorder, callbacks } = record();
      loop.start(callbacks);
      loop.stop();

      // Each start primes once. The final step adds one frame.
      loop.start();
      source.step(16);
      assert.strictEqual(recorder.frames.length, 3);

      loop.stop();
      const replacement = record();
      loop.start(replacement.callbacks);
      source.step(16);

      assert.strictEqual(recorder.frames.length, 3);
      assert.strictEqual(replacement.recorder.frames.length, 2);
    });
  });

  describe("layer agreement", () => {
    for (const tape of Object.values(scenarios)) {
      test(`${tape.name}: callbacks match the schedules the scheduler predicts`, () => {
        const { schedules } = replayTape(tape);
        const { recorder, callbacks } = record();
        const tapeSource = new ManualFrameSource();
        const tapeLoop = new GameLoop({ source: tapeSource, ...tape.options });

        tapeLoop.start(callbacks);
        tapeSource.run(tape);

        const expectedSteps = schedules
          .reduce((total, { steps }) => total + steps, 0);
        const expectedUpdates = schedules
          .filter(({ render }) => render).length;

        assert.deepStrictEqual(recorder.frames.slice(1), schedules);
        assert.strictEqual(recorder.fixedUpdate.length, expectedSteps);
        assert.strictEqual(recorder.update.length - 1, expectedUpdates);
      });
    }
  });
});
