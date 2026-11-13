// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  AssetNotReadyError,
  AssetReference,
  type AssetRecord,
  AssetType
} from "../../src/index.ts";
import {
  createCoordinator,
  TEXT_ASSET,
  textReference
} from "../helpers/coordinator.ts";

// CONSTANTS
const kForeignTextAsset = new AssetType<string>("text");

async function readSource(
  record: AssetRecord
): Promise<string> {
  return record.path.toString();
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

  test("loads the assets a loader depends on into the same coordinator", async() => {
    const coordinator = createCoordinator(async(record, context) => {
      if (record.id.value === "farewell") {
        return "bye";
      }
      const farewell = await context.assets.load(textReference("farewell"));
      const found = context.assets.catalog.get("farewell").path.toString();

      return `hello, ${farewell} from ${found}`;
    });

    const greeting = await coordinator.load(textReference("greeting"));

    assert.equal(greeting, "hello, bye from memory:farewell");
    assert.equal(coordinator.get(textReference("farewell")), "bye");
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

      return record.path.toString();
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

      return record.path.toString();
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

    assert.equal(coordinator.evict(reference), "memory:greeting");
    assert.equal(handle.status, "unloaded");
    assert.equal(coordinator.evict(reference), undefined);
  });

  test("a load settling after evict does not resurrect the entry", async() => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const coordinator = createCoordinator(() => promise);
    const reference = textReference("greeting");
    const handle = coordinator.request(reference);

    const pending = coordinator.load(reference);
    coordinator.evict(reference);
    resolve("stale");

    assert.equal(await pending, "stale");
    assert.equal(handle.status, "unloaded");
  });

  test("rejects another token for a kind with a registered loader", async() => {
    const coordinator = createCoordinator(readSource);
    const foreign = new AssetReference("greeting", kForeignTextAsset);
    const mismatch = {
      name: "AssetTypeMismatchError",
      kind: TEXT_ASSET.kind
    };

    assert.throws(() => coordinator.request(foreign), mismatch);
    assert.throws(() => coordinator.get(foreign), mismatch);
    assert.throws(() => coordinator.loadBatch([foreign]), mismatch);
    await assert.rejects(coordinator.load(foreign), mismatch);

    await coordinator.load(textReference("greeting"));

    assert.throws(() => coordinator.evict(foreign), mismatch);
    assert.equal(
      coordinator.get(textReference("greeting")),
      "memory:greeting"
    );
  });

  test("can load only a cataloged asset of the reference's kind through its registered token", () => {
    const coordinator = createCoordinator(readSource);

    assert.equal(coordinator.canLoad(textReference("greeting")), true);
    assert.equal(coordinator.canLoad(textReference("deleted")), false);
    assert.equal(
      coordinator.canLoad(new AssetReference("greeting", new AssetType("model"))),
      false
    );
    assert.equal(
      coordinator.canLoad(new AssetReference("greeting", kForeignTextAsset)),
      false
    );
  });
});
