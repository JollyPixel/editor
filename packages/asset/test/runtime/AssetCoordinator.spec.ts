// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetNotReadyError,
  AssetRecord,
  AssetReference,
  AssetType
} from "../../src/index.ts";

// CONSTANTS
const kTextAsset = new AssetType<string>("text");

function createCoordinator(): AssetCoordinator {
  const loaders = new AssetLoaderRegistry();
  loaders.register(kTextAsset, {
    load: async(record) => record.source.replace("memory:", "")
  });

  return new AssetCoordinator({
    catalog: new AssetCatalog([
      new AssetRecord({
        id: "greeting",
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
    const reference = new AssetReference("greeting", kTextAsset);
    const handle = coordinator.request(reference);

    await setImmediate();

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
    const reference = new AssetReference("greeting", kTextAsset);
    const handle = coordinator.request(reference);

    const value = await coordinator.load(reference);

    assert.equal(value, "greeting");
    assert.equal(handle.get(), "greeting");
    assert.equal(coordinator.get(reference), "greeting");
  });
});
