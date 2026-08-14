// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetId,
  AssetNotReadyError,
  AssetReference,
  AssetStore,
  AssetType,
  AssetTypeMismatchError
} from "../src/index.ts";

const TEXT_ASSET = new AssetType<string>("text");

describe("AssetStore", () => {
  test("keeps resolved values scoped to one store", async() => {
    const reference = new AssetReference<string>(
      new AssetId("greeting"),
      TEXT_ASSET
    );
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
    const reference = new AssetReference<string>(
      new AssetId("greeting"),
      TEXT_ASSET
    );
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
    const reference = new AssetReference<string>(
      new AssetId("greeting"),
      TEXT_ASSET
    );
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

  test("evicts a resolved value for catalog or revision changes", async() => {
    const id = new AssetId("greeting");
    const reference = new AssetReference(id, TEXT_ASSET);
    const store = new AssetStore();
    const handle = store.request(reference);
    await store.load(
      reference,
      async() => "hello"
    );

    const evicted = store.evict(id);

    assert.equal(evicted, "hello");
    assert.equal(handle.status, "unloaded");
  });

  test("rejects a different type token for an existing kind", () => {
    const id = new AssetId("greeting");
    const store = new AssetStore();
    store.request(
      new AssetReference(id, TEXT_ASSET)
    );

    assert.throws(
      () => store.request(
        new AssetReference(
          id,
          new AssetType<number>("text")
        )
      ),
      AssetTypeMismatchError
    );
  });
});
