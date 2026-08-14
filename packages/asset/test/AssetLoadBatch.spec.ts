// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetBatchLoadError,
  AssetCatalog,
  AssetCoordinator,
  AssetId,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference,
  AssetType
} from "../src/index.ts";

const TEXT_ASSET = new AssetType<string>("text");

function createCoordinator(
  load: (record: AssetRecord) => Promise<string>
): AssetCoordinator {
  const catalog = new AssetCatalog([
    new AssetRecord({
      id: new AssetId("greeting"),
      kind: "text",
      source: "memory:greeting"
    }),
    new AssetRecord({
      id: new AssetId("farewell"),
      kind: "text",
      source: "memory:farewell"
    })
  ]);
  const loaders = new AssetLoaderRegistry();
  loaders.register(TEXT_ASSET, {
    load
  });

  return new AssetCoordinator({
    catalog,
    loaders
  });
}

function reference(
  id: string
): AssetReference<string> {
  return new AssetReference(
    new AssetId(id),
    TEXT_ASSET
  );
}

async function rejectWithoutError(): Promise<string> {
  // Simulates a third-party loader rejecting without an Error.
  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject(undefined);
}

describe("AssetLoadBatch", () => {
  test("loads an explicit dependency snapshot", async() => {
    const coordinator = createCoordinator(
      async(record) => record.source
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
    const pendingLoad = promise;
    let loadCount = 0;
    const coordinator = createCoordinator(async() => {
      loadCount++;

      return pendingLoad;
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
    assert.ok(resolve !== undefined);
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
    const coordinator = createCoordinator(async(record) => {
      if (record.id.value === "farewell") {
        throw new Error("unavailable");
      }

      return "loaded";
    });
    const successfulProgress: number[] = [];
    const failedProgress: number[] = [];
    const successful = coordinator.loadBatch(
      [reference("greeting")],
      {
        onProgress(progress) {
          successfulProgress.push(progress.completed);
        }
      }
    );
    const failed = coordinator.loadBatch(
      [reference("farewell")],
      {
        onProgress(progress) {
          failedProgress.push(progress.completed);
        }
      }
    );

    await successful.done;
    await assert.rejects(failed.done, AssetBatchLoadError);

    assert.equal(successful.status, "ready");
    assert.equal(successful.failures.length, 0);
    assert.deepEqual(successfulProgress, [1]);
    assert.equal(failed.status, "failed");
    assert.equal(failed.failures.length, 1);
    assert.deepEqual(failedProgress, [1]);
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

  test("does not report progress callback errors as load failures", async() => {
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

    await assert.rejects(batch.done, progressError);

    assert.equal(batch.status, "failed");
    assert.equal(batch.failures.length, 0);
    assert.equal(progressCount, 1);
  });

  test("narrows progress errors from the discriminant", () => {
    const coordinator = createCoordinator(async() => "loaded");

    coordinator.loadBatch([], {
      onProgress(progress) {
        if (progress.status === "failed") {
          const error: unknown = progress.error;
          void error;
        }
        else {
          // @ts-expect-error Ready progress has no error value.
          void progress.error;
        }
      }
    });
  });
});
