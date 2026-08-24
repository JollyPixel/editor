// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ManualClock, ManualFrameSource } from "../../src/index.ts";
import { scenarios } from "../../fixtures/scenarios.ts";

describe("Loop.ManualFrameSource", () => {
  test("emits a priming frame on start, then one frame per step", () => {
    const source = new ManualFrameSource();
    const times: number[] = [];

    source.start((now) => times.push(now!));
    assert.strictEqual(source.running, true);

    source.step(16);
    source.step(4);

    assert.deepStrictEqual(times, [0, 16, 20]);
  });

  test("step() returns the new time and defaults to a zero delta", () => {
    const source = new ManualFrameSource(new ManualClock(500));
    source.start(() => void 0);

    assert.strictEqual(source.step(), 500);
    assert.strictEqual(source.step(10), 510);
    assert.strictEqual(source.clock.now(), 510);
  });

  test("step() while stopped throws rather than silently doing nothing", () => {
    const source = new ManualFrameSource();

    assert.throws(() => source.step(16), /while stopped/);

    source.start(() => void 0);
    source.stop();
    assert.strictEqual(source.running, false);
    assert.throws(() => source.step(16), /while stopped/);
  });

  test("run() replays raw deltas and named tapes alike", () => {
    const source = new ManualFrameSource();
    const times: number[] = [];
    source.start((now) => times.push(now!));

    source.run([10, 10, 10]);
    assert.deepStrictEqual(times.slice(1), [10, 20, 30]);

    const tapeSource = new ManualFrameSource();
    let frames = 0;
    tapeSource.start(() => {
      frames++;
    });
    tapeSource.run(scenarios.tabSwitch);

    assert.strictEqual(frames, scenarios.tabSwitch.deltas.length + 1);
  });
});
