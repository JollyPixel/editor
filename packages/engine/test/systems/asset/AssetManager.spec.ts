// Import Node.js Dependencies
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

// Import Internal Dependencies
import { Asset } from "../../../src/systems/asset/Base.ts";
import { AssetManager } from "../../../src/systems/asset/Manager.ts";

describe("Systems.AssetManager", () => {
  let assetManager: AssetManager;
  let mockLoader: (asset: Asset, context: any) => Promise<string>;

  beforeEach(() => {
    assetManager = new AssetManager();
    mockLoader = (asset, _context) => Promise.resolve(`loaded-${asset.name}`);
  });

  test("should initialize with default values", () => {
    const manager = new AssetManager();

    assert.ok(manager.registry);
    assert.ok(manager.waiting);
    assert.ok(manager.assets instanceof Map);
    assert.strictEqual(manager.autoload, false);
  });

  test("should load asset and return lazy loader", () => {
    assetManager.registry.loader(
      { type: "texture", extensions: [".png"] },
      mockLoader
    );

    const lazyAsset = assetManager.load("/images/player.png");

    assert.ok(lazyAsset.asset);
    assert.strictEqual(lazyAsset.asset.name, "player");
    assert.strictEqual(lazyAsset.asset.type, "texture");
    assert.strictEqual(typeof lazyAsset.get, "function");
  });

  test("should queue assets for loading", () => {
    assetManager.load("/test1.png");
    assetManager.load("/test2.jpg");

    // Assets should be queued
    const queuedAssets = assetManager.waiting.dequeueAll();
    assert.strictEqual(queuedAssets.length, 2);
    assert.strictEqual(queuedAssets[0].name, "test1");
    assert.strictEqual(queuedAssets[1].name, "test2");
  });

  test("should get loaded asset by id", async() => {
    assetManager.registry.loader(
      { type: "texture", extensions: [".png"] },
      mockLoader
    );

    const lazyAsset = assetManager.load("/test.png");
    await assetManager.loadAssets(assetManager.context);

    const result = assetManager.get(lazyAsset.asset.id);
    assert.strictEqual(result, "loaded-test");
  });

  test("should throw error when getting non-existent asset", () => {
    assert.throws(
      () => assetManager.get("non-existent-id"),
      /Asset with id non-existent-id not found/
    );
  });

  test("should load all queued assets", async() => {
    assetManager.registry.loader(
      { type: "texture", extensions: [".png", ".jpg"] },
      mockLoader
    );

    const asset1 = assetManager.load("/image1.png");
    const asset2 = assetManager.load("/image2.jpg");

    await assetManager.loadAssets(assetManager.context);

    const result1 = assetManager.get(asset1.asset.id);
    const result2 = assetManager.get(asset2.asset.id);

    assert.strictEqual(result1, "loaded-image1");
    assert.strictEqual(result2, "loaded-image2");
  });

  test("should call onStart callback for each asset", async() => {
    assetManager.registry.loader(
      { type: "texture", extensions: [".png"] },
      mockLoader
    );

    assetManager.load("/test.png");

    const loadedAssets: Asset[] = [];
    await assetManager.loadAssets(assetManager.context, {
      onStart: (asset) => {
        loadedAssets.push(asset);
      }
    });

    assert.strictEqual(loadedAssets.length, 1);
    assert.strictEqual(loadedAssets[0].name, "test");
  });

  test("should throw error for unregistered asset type", async() => {
    assetManager.load("/unknown.xyz");

    await assert.rejects(
      () => assetManager.loadAssets(assetManager.context),
      /No loader registered for asset type: unknown/
    );
  });

  test("should return lazy loader function", () => {
    const lazyLoader = assetManager.lazyLoad();

    assert.strictEqual(typeof lazyLoader, "function");

    assetManager.registry.loader(
      { type: "texture", extensions: [".png"] },
      mockLoader
    );

    const lazyAsset = lazyLoader("/test.png");
    assert.ok(lazyAsset.asset);
    assert.strictEqual(typeof lazyAsset.get, "function");
  });

  test("should handle empty queue gracefully", async() => {
    // No assets loaded, should complete without error
    await assert.doesNotReject(
      () => assetManager.loadAssets(assetManager.context)
    );
  });
});
