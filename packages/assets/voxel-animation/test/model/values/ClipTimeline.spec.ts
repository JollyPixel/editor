// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ClipTimeline } from "#src/model/values/ClipTimeline.ts";

describe("ClipTimeline", () => {
  test("wraps a loop and holds a one-shot at its ends", () => {
    const looped = new ClipTimeline({ length: 100, fps: 24, loop: true });
    const once = looped.with({ loop: false });

    assert.equal(looped.tickAt(250), 50);
    assert.equal(looped.tickAt(-10), 90);
    assert.equal(once.tickAt(250), 100);
    assert.equal(once.tickAt(-10), 0);
  });
});
