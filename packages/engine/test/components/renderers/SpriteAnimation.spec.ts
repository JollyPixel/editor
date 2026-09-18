// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SpriteAnimation } from "../../../src/components/renderers/sprite/SpriteAnimation.ts";

function collectFrames(
  animation: SpriteAnimation,
  steps: number,
  deltaTime: number
): (number | null)[] {
  return Array.from({ length: steps }, () => animation.update(deltaTime));
}

describe("Components.Renderers.SpriteAnimation", () => {
  test("should play a non-looping animation through its last frame", () => {
    const animation = new SpriteAnimation({ walk: [4, 5, 6, 7] });
    animation.play("walk", { duration: 0.4 });

    const frames = collectFrames(animation, 5, 0.1);

    assert.deepEqual(frames, [5, 6, 7, null, null]);
    assert.strictEqual(animation.isPlaying, false);
  });

  test("should wrap a looping animation back to its first frame", () => {
    const animation = new SpriteAnimation({ idle: { from: 0, to: 2 } });
    animation.play("idle", { duration: 0.3, loop: true });

    const frames = collectFrames(animation, 4, 0.1);

    assert.deepEqual(frames, [1, 2, 0, 1]);
    assert.strictEqual(animation.isPlaying, true);
  });

  test("should skip frames when a step spans several of them", () => {
    const animation = new SpriteAnimation({ walk: [0, 1, 2, 3] });
    animation.play("walk", { duration: 0.5, loop: true });

    assert.strictEqual(animation.update(0.3125), 2);
    assert.strictEqual(animation.update(0.0625), 3);
  });

  test("should hold its frame while paused", () => {
    const animation = new SpriteAnimation({ walk: [0, 1, 2, 3] });
    animation.play("walk", { duration: 0.4, loop: true });

    animation.pause();
    assert.strictEqual(animation.update(1), null);

    animation.resume();
    assert.strictEqual(animation.update(0.1), 1);
  });
});
