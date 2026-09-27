// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetLoaderAlreadyExistsError,
  AssetLoaderNotFoundError,
  AssetLoaderRegistry,
  AssetType,
  AssetTypeMismatchError,
  type AssetLoader
} from "../../src/index.ts";

// CONSTANTS
const kTextAsset = new AssetType<string>("text");
const kTextLoader: AssetLoader<string> = {
  load: async(record) => record.source
};

describe("AssetLoaderRegistry", () => {
  test("returns the loader registered for a type", () => {
    const registry = new AssetLoaderRegistry()
      .register(kTextAsset, kTextLoader);

    assert.equal(registry.get(kTextAsset), kTextLoader);
    assert.ok(registry.has(kTextAsset));
  });

  test("rejects a second loader for the same kind", () => {
    const registry = new AssetLoaderRegistry()
      .register(kTextAsset, kTextLoader);

    assert.throws(
      () => registry.register(new AssetType<string>("text"), kTextLoader),
      AssetLoaderAlreadyExistsError
    );
  });

  test("throws for a kind without a loader", () => {
    const registry = new AssetLoaderRegistry();

    assert.equal(registry.has(kTextAsset), false);
    assert.throws(
      () => registry.get(kTextAsset),
      AssetLoaderNotFoundError
    );
  });

  test("rejects another type token for a registered kind", () => {
    const registry = new AssetLoaderRegistry()
      .register(kTextAsset, kTextLoader);
    const otherToken = new AssetType<number>("text");

    assert.equal(registry.has(otherToken), false);
    assert.throws(
      () => registry.get(otherToken),
      AssetTypeMismatchError
    );
  });
});
