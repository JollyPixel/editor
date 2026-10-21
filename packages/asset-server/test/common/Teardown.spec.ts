// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Teardown } from "#src/common/Teardown.ts";

describe("Teardown", () => {
  test("runs the deferred steps last first, past a failing one", async() => {
    const teardown = new Teardown();
    const order: string[] = [];
    const failure = new Error("watcher close failed");
    teardown.defer(() => order.push("projector"));
    teardown.defer(() => {
      throw failure;
    });
    teardown.defer(async() => order.push("catalog"));

    await assert.rejects(teardown.run(), failure);

    assert.deepEqual(order, ["catalog", "projector"]);
  });

  test("runs each step once", async() => {
    const teardown = new Teardown();
    let runs = 0;
    teardown.defer(() => runs++);

    await teardown.run();
    await teardown.run();

    assert.strictEqual(runs, 1);
  });

  test("unwind rethrows the error when every step succeeds", async() => {
    const teardown = new Teardown();
    const error = new Error("folders unavailable");
    teardown.defer(() => undefined);

    await assert.rejects(teardown.unwind(error), error);
  });

  test("unwind reports the error first, then the step failures", async() => {
    const teardown = new Teardown();
    const error = new Error("folders unavailable");
    const failure = new Error("watcher close failed");
    teardown.defer(() => {
      throw failure;
    });

    await assert.rejects(
      teardown.unwind(error),
      (thrown: unknown) => {
        assert.ok(thrown instanceof AggregateError);
        assert.strictEqual(thrown.message, error.message);
        assert.deepEqual(thrown.errors, [error, failure]);

        return true;
      }
    );
  });
});
