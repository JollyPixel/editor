// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetBatchLoadError,
  type AssetLoadProgress
} from "../../src/index.ts";
import {
  createCoordinator,
  textReference as reference
} from "../helpers/coordinator.ts";

function summarize(
  progress: AssetLoadProgress
) {
  return {
    ...progress,
    record: progress.record.id.value
  };
}

async function rejectWithoutError(): Promise<string> {
  const reason: unknown = undefined;

  throw reason;
}

describe("AssetLoadBatch", () => {
  test("loads an explicit dependency snapshot", async() => {
    const coordinator = createCoordinator(
      async(record) => record.path.toString()
    );
    const greeting = reference("greeting");
    const handle = coordinator.request(greeting);

    const batch = coordinator.loadBatch([greeting]);

    assert.equal(batch.status, "loading");
    assert.equal(batch.completed, 0);
    assert.equal(batch.total, 1);

    await batch.done;

    assert.equal(batch.status, "ready");
    assert.equal(batch.completed, 1);
    assert.equal(handle.get(), "memory:greeting");
  });

  test("deduplicates repeated references inside one batch", async() => {
    let loadCount = 0;
    const coordinator = createCoordinator(async() => {
      loadCount++;

      return "loaded";
    });
    const greeting = reference("greeting");
    const batch = coordinator.loadBatch([
      greeting,
      greeting
    ]);

    await batch.done;

    assert.equal(batch.total, 1);
    assert.equal(batch.completed, 1);
    assert.equal(loadCount, 1);
  });

  test("snapshots references when the batch is created", async() => {
    const coordinator = createCoordinator(async() => "loaded");
    const dependencies = [
      reference("greeting")
    ];

    const batch = coordinator.loadBatch(dependencies);
    dependencies.push(reference("farewell"));
    await batch.done;

    assert.equal(batch.total, 1);
  });

  test("tracks overlapping batches independently", async() => {
    const { promise, resolve } = Promise.withResolvers<string>();
    let loadCount = 0;
    const coordinator = createCoordinator(async() => {
      loadCount++;

      return promise;
    });
    const greeting = reference("greeting");

    const first = coordinator.loadBatch([
      greeting
    ]);
    const second = coordinator.loadBatch([
      greeting
    ]);
    await Promise.resolve();

    assert.equal(loadCount, 1);
    assert.equal(first.completed, 0);
    assert.equal(second.completed, 0);
    resolve("loaded");

    await Promise.all([
      first.done,
      second.done
    ]);

    assert.equal(first.completed, 1);
    assert.equal(second.completed, 1);
    assert.equal(first.status, "ready");
    assert.equal(second.status, "ready");
  });

  test("includes ready assets in the initial completed count", async() => {
    let loadCount = 0;
    const coordinator = createCoordinator(async() => {
      loadCount++;

      return "loaded";
    });
    const greeting = reference("greeting");
    await coordinator.load(greeting);

    const batch = coordinator.loadBatch([
      greeting
    ]);

    assert.equal(batch.status, "ready");
    assert.equal(batch.completed, 1);
    assert.equal(batch.total, 1);
    await batch.done;
    assert.equal(loadCount, 1);
  });

  test("completes an empty batch immediately", async() => {
    const coordinator = createCoordinator(async() => "loaded");

    const batch = coordinator.loadBatch([]);

    assert.equal(batch.status, "ready");
    assert.equal(batch.completed, 0);
    assert.equal(batch.total, 0);
    await batch.done;
  });

  test("keeps progress and failures local to their batch", async() => {
    const unavailable = new Error("unavailable");
    const coordinator = createCoordinator(async(record) => {
      if (record.id.value === "farewell") {
        throw unavailable;
      }

      return "loaded";
    });
    const successfulProgress: unknown[] = [];
    const failedProgress: unknown[] = [];
    const successful = coordinator.loadBatch(
      [reference("greeting")],
      {
        onProgress(progress) {
          successfulProgress.push(summarize(progress));
        }
      }
    );
    const failed = coordinator.loadBatch(
      [reference("farewell")],
      {
        onProgress(progress) {
          failedProgress.push(summarize(progress));
        }
      }
    );

    await successful.done;
    await assert.rejects(failed.done, AssetBatchLoadError);

    assert.equal(successful.status, "ready");
    assert.equal(successful.failures.length, 0);
    assert.deepEqual(successfulProgress, [
      { record: "greeting", status: "ready", completed: 1, total: 1 }
    ]);
    assert.equal(failed.status, "failed");
    assert.equal(failed.failures.length, 1);
    assert.deepEqual(failedProgress, [
      {
        record: "farewell",
        status: "failed",
        error: unavailable,
        completed: 1,
        total: 1
      }
    ]);
  });

  test("retries a failed asset in a later batch", async() => {
    let loadCount = 0;
    const coordinator = createCoordinator(async() => {
      loadCount++;
      if (loadCount === 1) {
        throw new Error("offline");
      }

      return "loaded";
    });
    const greeting = reference("greeting");
    const failed = coordinator.loadBatch([
      greeting
    ]);
    await assert.rejects(failed.done, AssetBatchLoadError);

    const retried = coordinator.loadBatch([
      greeting
    ]);
    await retried.done;

    assert.equal(retried.status, "ready");
    assert.equal(retried.completed, 1);
    assert.equal(loadCount, 2);
  });

  test("records a rejection without an error value", async() => {
    const coordinator = createCoordinator(rejectWithoutError);
    const batch = coordinator.loadBatch([
      reference("greeting")
    ]);

    await assert.rejects(
      batch.done,
      (error: unknown) => {
        assert.ok(error instanceof AssetBatchLoadError);
        assert.equal(error.failures.length, 1);
        assert.equal(error.failures[0]?.error, undefined);

        return true;
      }
    );
    assert.equal(batch.status, "failed");
  });

  test("rethrows progress callback errors outside the batch", async(t) => {
    const queued: Array<() => void> = [];
    t.mock.method(globalThis, "queueMicrotask", (callback: () => void) => {
      queued.push(callback);
    });
    const coordinator = createCoordinator(async() => "loaded");
    const progressError = new Error("progress failed");
    let progressCount = 0;
    const batch = coordinator.loadBatch(
      [reference("greeting")],
      {
        onProgress() {
          progressCount++;

          throw progressError;
        }
      }
    );

    await batch.done;

    assert.equal(batch.status, "ready");
    assert.equal(progressCount, 1);
    assert.equal(queued.length, 1);
    assert.throws(() => queued[0]?.(), progressError);
  });
});
