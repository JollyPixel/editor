// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LightQueue } from "../../../src/view/lighting/LightQueue.ts";

function drain(
  queue: LightQueue,
  count: number
): number[] {
  const xs: number[] = [];
  for (let i = 0; i < count && queue.next(); i++) {
    assert.deepEqual([queue.y, queue.z], [queue.x + 1, queue.x + 2]);
    xs.push(queue.x);
  }

  return xs;
}

describe("LightQueue", () => {
  it("keeps first-in first-out order while it grows and compacts", () => {
    const queue = new LightQueue();
    const pushed: number[] = [];
    const popped: number[] = [];
    let next = 0;

    for (const [push, pop] of [[10_000, 9_000], [12_000, 2_000], [6_000, Infinity]]) {
      for (let i = 0; i < push; i++, next++) {
        queue.push(next, next + 1, next + 2);
        pushed.push(next);
      }
      popped.push(...drain(queue, pop));
    }

    assert.deepEqual(popped, pushed);
    assert.equal(queue.next(), false);
  });
});
