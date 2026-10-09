// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FrameRate } from "#src/model/values/FrameRate.ts";

describe("FrameRate", () => {
  test("keeps the usual frame rates on whole ticks", () => {
    for (const fps of [12, 24, 25, 30, 48, 60]) {
      assert.equal(FrameRate.isValid(fps), true, String(fps));
    }
    assert.equal(FrameRate.isValid(7), false);
    assert.equal(FrameRate.isValid(24.5), false);
  });

  test("rejects an fps off the tick grid", () => {
    assert.throws(() => new FrameRate(7), RangeError);
    assert.throws(() => new FrameRate(0), RangeError);
  });

  test("converts between frames and ticks", () => {
    assert.equal(new FrameRate(24).toTick(12), 12000);
    assert.equal(new FrameRate(30).toFrame(12000), 15);
    assert.equal(new FrameRate(24).frameAt(12499), 12);
    assert.equal(new FrameRate(12).snap(1499), 2000);
    assert.equal(new FrameRate(12).snap(999), 0);
  });
});
