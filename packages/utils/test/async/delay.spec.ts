// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { delay } from "#src/index.ts";

describe("delay", () => {
  test("resolves once the delay has elapsed", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let resolved = false;
    const waiting = delay(100).then(() => {
      resolved = true;
    });

    t.mock.timers.tick(99);
    await Promise.resolve();
    assert.equal(resolved, false);

    t.mock.timers.tick(1);
    await waiting;
    assert.equal(resolved, true);
  });
});
