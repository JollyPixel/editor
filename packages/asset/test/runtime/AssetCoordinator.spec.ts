// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  AssetNotReadyError,
  AssetReference,
  type AssetRecord,
  AssetType,
  AssetTypeMismatchError
} from "../../src/index.ts";
import {
  createCoordinator,
  textReference
} from "../helpers/coordinator.ts";

// CONSTANTS
const kForeignTextAsset = new AssetType<string>("text");

async function readSource(
  record: AssetRecord
): Promise<string> {
  return record.source;
}

describe("AssetCoordinator", () => {
  test("returns a handle without scheduling an implicit load", async() => {
    const coordinator = createCoordinator(readSource);
    const reference = textReference("greeting");
    const handle = coordinator.request(reference);

    await setImmediate();

    assert.equal(handle.status, "unloaded");
    assert.throws(
      () => handle.get(),
      AssetNotReadyError
    );
    assert.throws(
      () => coordinator.get(reference),
      {
        name: "AssetNotReadyError",
        status: "unloaded"
      }
    );
  });

  test("loads one dynamic asset explicitly", async() => {
    const coordinator = createCoordinator(readSource);
    const reference = textReference("greeting");
    const handle = coordinator.request(reference);

    const value = await coordinator.load(reference);

    assert.equal(value, "memory:greeting");
    assert.equal(handle.get(), "memory:greeting");
    assert.equal(coordinator.get(reference), "memory:greeting");
  });

  test("forwards the load context to the loader", async() => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    const coordinator = createCoordinator(async(record, context) => {
      received = context.signal;

      return record.source;
    });

    await coordinator.load(textReference("greeting"), {
      signal: controller.signal
    });

    assert.equal(received, controller.signal);
  });

  test("keeps loaded values scoped to one coordinator", async() => {
    const reference = textReference("greeting");
    const first = createCoordinator(readSource);
    const second = createCoordinator(readSource);

    await first.load(reference);

    assert.equal(first.request(reference).status, "ready");
    assert.equal(second.request(reference).status, "unloaded");
  });

  test("deduplicates concurrent loads", async() => {
    let loadCount = 0;
    const coordinator = createCoordinator(async(record) => {
      loadCount++;

      return record.source;
    });
    const reference = textReference("greeting");

    const [first, second] = await Promise.all([
      coordinator.load(reference),
      coordinator.load(reference)
    ]);

    assert.equal(first, "memory:greeting");
    assert.equal(second, "memory:greeting");
    assert.equal(loadCount, 1);
  });

  test("records failures and permits an explicit retry", async() => {
    const failure = new Error("offline");
    let loadCount = 0;
    const coordinator = createCoordinator(async(record) => {
      loadCount++;
      if (loadCount === 1) {
        throw failure;
      }

      return record.source;
    });
    const reference = textReference("greeting");
    const handle = coordinator.request(reference);

    await assert.rejects(coordinator.load(reference), failure);
    assert.equal(handle.status, "failed");
    assert.equal(handle.error, failure);

    await coordinator.load(reference);

    assert.equal(handle.status, "ready");
    assert.equal(handle.error, undefined);
    assert.equal(handle.get(), "memory:greeting");
  });

  test("evict returns the ready value and resets the entry", async() => {
    const coordinator = createCoordinator(readSource);
    const reference = textReference("greeting");
    const handle = coordinator.request(reference);
    await coordinator.load(reference);

    assert.equal(coordinator.evict("greeting"), "memory:greeting");
    assert.equal(handle.status, "unloaded");
    assert.equal(coordinator.evict("greeting"), undefined);
  });

  test("a load settling after evict does not resurrect the entry", async() => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const coordinator = createCoordinator(() => promise);
    const reference = textReference("greeting");
    const handle = coordinator.request(reference);

    const pending = coordinator.load(reference);
    coordinator.evict(reference.id);
    resolve("stale");

    assert.equal(await pending, "stale");
    assert.equal(handle.status, "unloaded");
  });

  test("requesting through another token does not claim the asset", async() => {
    const coordinator = createCoordinator(readSource);
    const foreign = new AssetReference("greeting", kForeignTextAsset);

    assert.equal(coordinator.request(foreign).status, "unloaded");
    assert.equal(
      await coordinator.load(textReference("greeting")),
      "memory:greeting"
    );
  });

  test("rejects another token for a loaded asset", async() => {
    const coordinator = createCoordinator(readSource);
    const foreign = new AssetReference("greeting", kForeignTextAsset);
    await coordinator.load(textReference("greeting"));

    assert.throws(
      () => coordinator.request(foreign).status,
      {
        name: "AssetTypeMismatchError",
        kind: "text"
      }
    );
    assert.throws(
      () => coordinator.get(foreign),
      AssetTypeMismatchError
    );
  });

  test("loads only through the registered token", async() => {
    const coordinator = createCoordinator(readSource);

    await assert.rejects(
      coordinator.load(new AssetReference("greeting", kForeignTextAsset)),
      AssetTypeMismatchError
    );
  });
});
