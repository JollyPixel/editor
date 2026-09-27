// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LatestFrameThrottle } from "#src/collaboration/LatestFrameThrottle.ts";

describe("LatestFrameThrottle", () => {
  test("sends the first frame at once and the latest one at the end of the interval", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const sent: number[] = [];
    const throttle = new LatestFrameThrottle<number>(50, (frame) => sent.push(frame));

    throttle.push(1);
    throttle.push(2);
    throttle.push(3);
    assert.deepEqual(sent, [1]);

    t.mock.timers.tick(50);
    assert.deepEqual(sent, [1, 3]);
  });

  test("drops the waiting frame on cancel and sends the next push at once", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const sent: number[] = [];
    const throttle = new LatestFrameThrottle<number>(50, (frame) => sent.push(frame));

    throttle.push(1);
    throttle.push(2);
    throttle.cancel();
    t.mock.timers.tick(50);
    throttle.push(3);

    assert.deepEqual(sent, [1, 3]);
  });
});
