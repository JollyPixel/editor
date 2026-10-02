// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GameLoop,
  ManualFrameSource,
  type GameLoopOptions
} from "../src/index.ts";

function setup(
  options: GameLoopOptions = {}
) {
  const source = new ManualFrameSource();
  const loop = new GameLoop({
    source,
    keepAlive: () => false,
    ...options
  });
  const frames: number[] = [];
  const renders: number[] = [];
  const events: string[] = [];
  loop.on("wake", () => events.push("wake"));
  loop.on("sleep", () => events.push("sleep"));

  return {
    source,
    loop,
    frames,
    renders,
    events,
    start(
      onFrame: () => void = () => undefined
    ) {
      loop.start({
        frame: (_schedule, now) => {
          frames.push(now);
          onFrame();
        },
        update: (frameDeltaMs) => renders.push(frameDeltaMs)
      });
    }
  };
}

function stepWhileRunning(
  source: ManualFrameSource,
  count: number,
  deltaMs = 16
): number {
  let stepped = 0;
  while (stepped < count && source.running) {
    source.step(deltaMs);
    stepped++;
  }

  return stepped;
}

describe("Loop.GameLoop on demand", () => {
  test("rejects a negative or fractional trailingRenders", () => {
    assert.throws(
      () => new GameLoop({ trailingRenders: -1 }),
      RangeError
    );
    assert.throws(
      () => new GameLoop({ trailingRenders: 1.5 }),
      RangeError
    );
  });

  test("never sleeps without a keepAlive option", () => {
    const source = new ManualFrameSource();
    const loop = new GameLoop({ source });
    loop.start();

    assert.equal(stepWhileRunning(source, 20), 20);
    assert.equal(loop.sleeping, false);
  });

  test("sleeps after the first render and its trailing renders", () => {
    const { source, loop, frames, events, start } = setup();
    start();

    stepWhileRunning(source, 10);

    assert.equal(frames.length, 3);
    assert.equal(loop.sleeping, true);
    assert.equal(loop.running, true);
    assert.equal(source.running, false);
    assert.deepEqual(events, ["sleep"]);
  });

  test("invalidate() wakes a sleeping loop without the idle gap", () => {
    const { source, loop, renders, events, start } = setup({
      trailingRenders: 0
    });
    start();
    assert.equal(loop.sleeping, true);

    source.clock.advance(60_000);
    loop.invalidate();

    assert.deepEqual(renders, [0, 0]);
    assert.equal(loop.sleeping, true);
    assert.deepEqual(events, ["sleep", "wake", "sleep"]);
  });

  test("an invalidation during a frame grants one more render", () => {
    let pending = 2;
    const { source, loop, frames, start } = setup({ trailingRenders: 0 });
    start(() => {
      if (pending > 0) {
        pending--;
        loop.invalidate();
      }
    });

    stepWhileRunning(source, 10);

    assert.equal(frames.length, 3);
  });

  test("keepAlive holds frames until it returns false", () => {
    let alive = true;
    const { source, loop, frames, start } = setup({
      trailingRenders: 1,
      keepAlive: () => alive
    });
    start();

    assert.equal(stepWhileRunning(source, 20), 20);

    alive = false;
    const before = frames.length;
    stepWhileRunning(source, 20);

    assert.equal(frames.length - before, 2);
    assert.equal(loop.sleeping, true);
  });

  test("counts rendered frames, so a maxFps cap keeps stepping", () => {
    let alive = true;
    const { source, loop, frames, renders, start } = setup({
      trailingRenders: 0,
      maxFps: 10,
      keepAlive: () => alive
    });
    start();
    source.step(4);
    alive = false;
    const framesBefore = frames.length;
    const rendersBefore = renders.length;

    stepWhileRunning(source, 100, 4);

    assert.equal(renders.length - rendersBefore, 1);
    assert.ok(frames.length - framesBefore > 1);
    assert.equal(loop.sleeping, true);
  });

  test("stop() halts the loop and invalidate() does not wake it", () => {
    const { source, loop, frames, events, start } = setup();
    start();
    loop.stop();

    loop.invalidate();

    assert.equal(loop.sleeping, false);
    assert.equal(source.running, false);
    assert.equal(frames.length, 1);
    assert.deepEqual(events, []);
  });

  test("stop() from inside a frame does not emit sleep", () => {
    const { source, loop, events, start } = setup({ trailingRenders: 0 });
    start(() => loop.stop());

    assert.equal(source.running, false);
    assert.deepEqual(events, []);
  });

  test("start() after sleeping owes its renders again", () => {
    const { source, loop, start } = setup({ trailingRenders: 1 });
    start();
    source.step(16);
    assert.equal(loop.sleeping, true);

    loop.stop();
    loop.start();

    assert.equal(loop.sleeping, false);
    assert.equal(source.running, true);
  });
});
