// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InFlight } from "#src/index.ts";

describe("InFlight", () => {
  test("shares one run between concurrent callers of a key", async() => {
    const inFlight = new InFlight<number>();
    let runs = 0;
    async function work() {
      runs++;

      return runs;
    }

    const results = await Promise.all([
      inFlight.run("a", work),
      inFlight.run("a", work),
      inFlight.run("b", work)
    ]);

    assert.deepEqual(results, [1, 1, 2]);
  });

  test("runs the key again once the previous run settled", async() => {
    const inFlight = new InFlight<string>();

    await assert.rejects(
      inFlight.run("a", () => Promise.reject(new Error("offline"))),
      /offline/
    );

    assert.equal(await inFlight.run("a", async() => "loaded"), "loaded");
  });
});
