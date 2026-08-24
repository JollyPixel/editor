// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GameLoop, RafFrameSource } from "../../src/index.ts";

/**
 * Deterministic animation-frame scheduler without DOM timers.
 */
class FakeRaf {
  handle = 0;
  pending = new Map<number, (now: number) => void>();
  cancelled: number[] = [];
  now = 0;

  request = (callback: (now: number) => void): number => {
    this.handle++;
    this.pending.set(this.handle, callback);

    return this.handle;
  };

  cancel = (handle: number): void => {
    this.cancelled.push(handle);
    this.pending.delete(handle);
  };

  /**
   * Advances time and fires every pending callback.
   */
  flush(deltaMs = 16): void {
    this.now += deltaMs;
    const callbacks = [...this.pending.entries()];
    for (const [handle, callback] of callbacks) {
      this.pending.delete(handle);
      callback(this.now);
    }
  }
}

describe("Loop.RafFrameSource", () => {
  let raf: FakeRaf;

  beforeEach(() => {
    raf = new FakeRaf();
  });

  function createSource() {
    return new RafFrameSource({
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel
    });
  }

  test("throws when no animation frame function is available", () => {
    assert.throws(
      () => new RafFrameSource({ requestAnimationFrame: undefined }),
      TypeError
    );
  });

  test("requests a frame on start and reschedules itself", () => {
    const source = createSource();
    const times: number[] = [];

    source.start((now) => times.push(now!));
    assert.strictEqual(source.running, true);
    assert.strictEqual(raf.pending.size, 1);

    raf.flush(16);
    raf.flush(16);
    raf.flush(16);

    assert.deepStrictEqual(times, [16, 32, 48]);
    assert.strictEqual(raf.pending.size, 1);
  });

  test("stop() cancels the pending handle and leaves nothing scheduled", () => {
    const source = createSource();
    let frames = 0;

    source.start(() => {
      frames++;
    });
    raf.flush();
    source.stop();

    assert.strictEqual(source.running, false);
    assert.strictEqual(raf.pending.size, 0);
    assert.strictEqual(raf.cancelled.length, 1);

    raf.flush();
    assert.strictEqual(frames, 1);
  });

  test("stop() on a stopped source is a no-op", () => {
    const source = createSource();

    source.stop();
    source.stop();

    assert.strictEqual(raf.cancelled.length, 0);
  });

  test("start() twice leaks no handle", () => {
    const source = createSource();

    source.start(() => void 0);
    source.start(() => void 0);

    assert.strictEqual(raf.pending.size, 1);
    assert.strictEqual(raf.cancelled.length, 1);
  });

  test("a throwing callback does not kill the loop", () => {
    const source = createSource();
    let frames = 0;

    source.start(() => {
      frames++;
      throw new Error("host blew up");
    });

    assert.throws(() => raf.flush(), /host blew up/);
    assert.strictEqual(raf.pending.size, 1);

    assert.throws(() => raf.flush(), /host blew up/);
    assert.strictEqual(frames, 2);
  });

  test("drives a GameLoop end to end", () => {
    const loop = new GameLoop({ source: createSource() });
    const steps: number[] = [];

    loop.start({
      fixedUpdate: (_delta, stepIndex) => steps.push(stepIndex)
    });
    // The first frame primes the scheduler and reports a zero delta.
    raf.flush(16);
    raf.flush(60);

    assert.deepStrictEqual(steps, [0, 1, 2]);
    assert.strictEqual(loop.scheduler.elapsed, 60);

    loop.stop();
    assert.strictEqual(raf.pending.size, 0);
  });
});
