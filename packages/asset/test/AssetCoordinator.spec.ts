// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetId,
  AssetLoaderRegistry,
  AssetNotReadyError,
  AssetRecord,
  AssetReference,
  AssetType,
  AssetTypeMismatchError
} from "../src/index.ts";

const TEXT_ASSET = new AssetType<string>("text");

function createCoordinator(): AssetCoordinator {
  const loaders = new AssetLoaderRegistry();
  loaders.register(TEXT_ASSET, {
    load: async(record) => record.source.replace("memory:", "")
  });

  return new AssetCoordinator({
    catalog: new AssetCatalog([
      new AssetRecord({
        id: new AssetId("greeting"),
        kind: "text",
        source: "memory:greeting"
      })
    ]),
    loaders
  });
}

describe("AssetCoordinator", () => {
  test("returns a handle without scheduling an implicit load", async() => {
    const coordinator = createCoordinator();
    const reference = new AssetReference(
      new AssetId("greeting"),
      TEXT_ASSET
    );
    const handle = coordinator.request(reference);

    const batch = coordinator.loadBatch([]);
    await batch.done;

    assert.equal(handle.status, "unloaded");
    assert.throws(
      () => handle.get(),
      AssetNotReadyError
    );
    assert.throws(
      () => coordinator.get(reference),
      AssetNotReadyError
    );
  });

  test("loads one dynamic asset explicitly", async() => {
    const coordinator = createCoordinator();
    const reference = new AssetReference(
      new AssetId("greeting"),
      TEXT_ASSET
    );
    const handle = coordinator.request(reference);

    const value = await coordinator.load(reference);

    assert.equal(value, "greeting");
    assert.equal(handle.get(), "greeting");
    assert.equal(coordinator.get(reference), "greeting");
  });

  test("rejects a reference created with another token for the kind", async() => {
    const coordinator = createCoordinator();
    const reference = new AssetReference(
      new AssetId("greeting"),
      new AssetType<number>("text")
    );

    await assert.rejects(
      coordinator.load(reference),
      AssetTypeMismatchError
    );
  });
});
