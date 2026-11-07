// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AsyncTeardown,
  Teardown
} from "#src/index.ts";

describe("Teardown", () => {
  test("runs the deferred steps last first, past a failing one", () => {
    const teardown = new Teardown();
    const order: string[] = [];
    const failure = new Error("listener removal failed");
    teardown.defer(() => order.push("lease"));
    teardown.defer(() => {
      throw failure;
    });
    teardown.defer(() => order.push("binding"));

    assert.throws(() => teardown.run(), failure);

    assert.deepEqual(order, ["binding", "lease"]);
  });

  test("reports several failures in run order", () => {
    const teardown = new Teardown();
    const first = new Error("first deferred");
    const last = new Error("last deferred");
    teardown.defer(() => {
      throw first;
    });
    teardown.defer(() => {
      throw last;
    });

    assert.throws(
      () => teardown.run(),
      (thrown: unknown) => {
        assert.ok(thrown instanceof AggregateError);
        assert.deepEqual(thrown.errors, [last, first]);

        return true;
      }
    );
  });

  test("runs each step once", () => {
    const teardown = new Teardown();
    let runs = 0;
    teardown.defer(() => runs++);

    teardown.run();
    teardown.run();

    assert.strictEqual(runs, 1);
  });

  test("aborts the signal before the first step runs", () => {
    const teardown = new Teardown();
    const { signal } = teardown;
    let abortedDuringStep = false;
    teardown.defer(() => {
      abortedDuringStep = signal.aborted;
    });

    teardown.run();

    assert.strictEqual(abortedDuringStep, true);
  });

  test("hands out an aborted signal once it has run", () => {
    const teardown = new Teardown();

    teardown.run();

    assert.strictEqual(teardown.signal.aborted, true);
  });

  test("unwind reports the error first, then the step failures", () => {
    const teardown = new Teardown();
    const error = new Error("mount failed");
    const failure = new Error("listener removal failed");
    teardown.defer(() => {
      throw failure;
    });

    assert.throws(
      () => teardown.unwind(error),
      (thrown: unknown) => {
        assert.ok(thrown instanceof AggregateError);
        assert.strictEqual(thrown.message, error.message);
        assert.deepEqual(thrown.errors, [error, failure]);

        return true;
      }
    );
  });
});

describe("AsyncTeardown", () => {
  test("runs the deferred steps last first, past a failing one", async() => {
    const teardown = new AsyncTeardown();
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
    const teardown = new AsyncTeardown();
    let runs = 0;
    teardown.defer(() => runs++);

    await teardown.run();
    await teardown.run();

    assert.strictEqual(runs, 1);
  });

  test("unwind rethrows the error when every step succeeds", async() => {
    const teardown = new AsyncTeardown();
    const error = new Error("folders unavailable");
    teardown.defer(() => undefined);

    await assert.rejects(teardown.unwind(error), error);
  });

  test("unwind reports the error first, then the step failures", async() => {
    const teardown = new AsyncTeardown();
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
