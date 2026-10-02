// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AnimationLoopFrameSource,
  GameLoop,
  type AnimationLoopRenderer,
  type AnimationLoopRendererCallback
} from "../../src/index.ts";

class FakeRenderer implements AnimationLoopRenderer {
  callback: AnimationLoopRendererCallback | null = null;

  setAnimationLoop(
    callback: AnimationLoopRendererCallback | null
  ): void {
    this.callback = callback;
  }
}

describe("Loop.AnimationLoopFrameSource", () => {
  test("forwards renderer frames to the callback", () => {
    const renderer = new FakeRenderer();
    const source = new AnimationLoopFrameSource(renderer);
    const times: number[] = [];

    source.start((now) => times.push(now));
    renderer.callback?.(16);
    renderer.callback?.(32);

    assert.deepStrictEqual(times, [16, 32]);
  });

  test("clears the renderer loop on stop", () => {
    const renderer = new FakeRenderer();
    const source = new AnimationLoopFrameSource(renderer);

    source.start(() => void 0);
    source.stop();

    assert.strictEqual(renderer.callback, null);
  });

  test("drives a GameLoop", () => {
    const renderer = new FakeRenderer();
    const loop = new GameLoop({
      source: new AnimationLoopFrameSource(renderer)
    });
    let frames = 0;

    loop.start({
      frame: () => frames++
    });
    renderer.callback?.(0);
    renderer.callback?.(16);
    loop.stop();

    assert.strictEqual(frames, 2);
    assert.strictEqual(renderer.callback, null);
  });
});
