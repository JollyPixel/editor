// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetId,
  AssetKindMismatchError,
  AssetNotReadyError,
  AssetReference,
  AssetStore,
  AssetType,
  AssetTypeMismatchError
} from "../../src/index.ts";

// CONSTANTS
const kTextAsset = new AssetType<string>("text");
const kGreetingId = new AssetId("greeting");

function greeting(): AssetReference<string> {
  return new AssetReference(kGreetingId, kTextAsset);
}

describe("AssetStore", () => {
  test("keeps resolved values scoped to one store", async() => {
    const reference = greeting();
    const firstStore = new AssetStore();
    const secondStore = new AssetStore();
    const firstHandle = firstStore.request(reference);
    const secondHandle = secondStore.request(reference);

    await firstStore.load(
      reference,
      async() => "hello"
    );

    assert.equal(firstHandle.get(), "hello");
    assert.equal(firstHandle.status, "ready");
    assert.equal(secondHandle.status, "unloaded");
    assert.throws(
      () => secondHandle.get(),
      AssetNotReadyError
    );
  });

  test("deduplicates concurrent loads", async() => {
    const reference = greeting();
    const store = new AssetStore();
    let loadCount = 0;
    async function load() {
      loadCount++;

      return "hello";
    }

    const [first, second] = await Promise.all([
      store.load(reference, load),
      store.load(reference, load)
    ]);

    assert.equal(first, "hello");
    assert.equal(second, "hello");
    assert.equal(loadCount, 1);
  });

  test("records failures and permits an explicit retry", async() => {
    const reference = greeting();
    const store = new AssetStore();
    const handle = store.request(reference);
    const failure = new Error("offline");

    await assert.rejects(
      store.load(
        reference,
        async() => Promise.reject(failure)
      ),
      failure
    );
    assert.equal(handle.status, "failed");
    assert.equal(handle.error, failure);

    await store.load(
      reference,
      async() => "hello"
    );

    assert.equal(handle.status, "ready");
    assert.equal(handle.error, undefined);
    assert.equal(handle.get(), "hello");
  });

  test("evict returns the ready value and resets the entry", async() => {
    const reference = greeting();
    const store = new AssetStore();
    const handle = store.request(reference);
    await store.load(
      reference,
      async() => "hello"
    );

    const evicted = store.evict(kGreetingId);

    assert.equal(evicted, "hello");
    assert.equal(handle.status, "unloaded");
  });

  test("a load settling after evict does not resurrect the entry", async() => {
    const reference = greeting();
    const store = new AssetStore();
    const handle = store.request(reference);
    const { promise, resolve } = Promise.withResolvers<string>();

    const pending = store.load(reference, () => promise);
    store.evict(kGreetingId);
    resolve("stale");

    assert.equal(await pending, "stale");
    assert.equal(handle.status, "unloaded");
  });

  test("a load failing after clear does not mark the entry failed", async() => {
    const reference = greeting();
    const store = new AssetStore();
    const handle = store.request(reference);
    const failure = new Error("offline");
    const { promise, reject } = Promise.withResolvers<string>();

    const pending = store.load(reference, () => promise);
    store.clear();
    reject(failure);

    await assert.rejects(pending, failure);
    assert.equal(handle.status, "unloaded");
    assert.equal(handle.error, undefined);
  });

  test("rejects another kind for a requested id", () => {
    const store = new AssetStore();
    store.request(greeting());

    assert.throws(
      () => store.request(
        new AssetReference(kGreetingId, new AssetType<string>("audio"))
      ),
      AssetKindMismatchError
    );
  });

  test("rejects a different type token for an existing kind", () => {
    const store = new AssetStore();
    store.request(greeting());

    assert.throws(
      () => store.request(
        new AssetReference(kGreetingId, new AssetType<number>("text"))
      ),
      AssetTypeMismatchError
    );
  });
});
