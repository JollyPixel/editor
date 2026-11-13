// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { withTimeout } from "#src/index.ts";

describe("withTimeout", () => {
  test("resolves with the promise value when it settles in time", async() => {
    assert.equal(
      await withTimeout(Promise.resolve("ready"), 1_000, "too slow"),
      "ready"
    );
  });

  test("rejects with the message when the timeout fires first", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = withTimeout(
      new Promise<void>(() => void 0),
      100,
      "too slow"
    );

    t.mock.timers.tick(100);

    await assert.rejects(pending, { message: "too slow" });
  });
});
