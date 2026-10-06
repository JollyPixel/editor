// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GameLoop, ManualFrameSource } from "../src/index.ts";
import { scenarios } from "../fixtures/scenarios.ts";
import { record } from "./helpers/recorder.ts";
import { replayTape } from "./helpers/replay.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

describe("Loop.GameLoop callbacks", () => {
  let source: ManualFrameSource;
  let loop: GameLoop;

  beforeEach(() => {
    source = new ManualFrameSource();
    loop = new GameLoop({ source });
  });

  test("fixedUpdate receives the fixed delta and an incrementing stepIndex", () => {
    const { recorder, callbacks } = record();
    loop.start(callbacks);
    source.step(80);

    assert.deepStrictEqual(recorder.fixedUpdate, [
      [kFixedDelta60, 0],
      [kFixedDelta60, 1],
      [kFixedDelta60, 2],
      [kFixedDelta60, 3]
    ]);
    assert.strictEqual(recorder.update.length, 2);
    assert.deepStrictEqual(
      recorder.update[1],
      [80, recorder.frames[1].alpha]
    );
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

  test("update receives the time since the previous update under a render cap", () => {
    const { recorder, callbacks } = record();
    loop.scheduler.maxFps = 30;
    loop.start(callbacks);
    source.step(20);
    source.step(20);

    assert.strictEqual(recorder.update.length, 2);
    assert.strictEqual(recorder.update[1][0], 40);
  });

  test("frame carries the source timestamp", () => {
    const { recorder, callbacks } = record();
    loop.start(callbacks);
    source.step(16);
    source.step(4);

    assert.deepStrictEqual(
      recorder.timestamps,
      [0, 16, 20]
    );
  });

  test("callbacks survive a stop/start cycle unless replaced", () => {
    const { recorder, callbacks } = record();
    loop.start(callbacks);
    loop.stop();

    loop.start();
    source.step(16);
    assert.strictEqual(recorder.frames.length, 3);

    loop.stop();
    const replacement = record();
    loop.start(replacement.callbacks);
    source.step(16);

    assert.strictEqual(recorder.frames.length, 3);
    assert.strictEqual(
      replacement.recorder.frames.length,
      2
    );
  });

  describe("layer agreement", () => {
    for (const tape of Object.values(scenarios)) {
      test(`${tape.name}: callbacks match the schedules the scheduler predicts`, () => {
        const { schedules } = replayTape(tape);
        const { recorder, callbacks } = record();
        const tapeSource = new ManualFrameSource();
        const tapeLoop = new GameLoop({
          source: tapeSource,
          ...tape.options
        });

        tapeLoop.start(callbacks);
        tapeSource.run(tape);

        const expectedSteps = schedules
          .reduce((total, { steps }) => total + steps, 0);
        const expectedUpdates = schedules
          .filter(({ render }) => render).length;

        assert.deepStrictEqual(
          recorder.frames.slice(1),
          schedules
        );
        assert.strictEqual(
          recorder.fixedUpdate.length,
          expectedSteps
        );
        assert.strictEqual(
          recorder.update.length - 1,
          expectedUpdates
        );
      });
    }
  });
});
