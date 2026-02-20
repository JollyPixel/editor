// Import Node.js Dependencies
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

// Import Internal Dependencies
import { Asset } from "../../../src/systems/asset/Base.ts";
import { AssetManager } from "../../../src/systems/asset/Manager.ts";

describe("Systems.AssetManager", () => {
  let assetManager: AssetManager;
  let mockLoader: (asset: Asset, context: any, options?: any) => Promise<string>;

  beforeEach(() => {
    assetManager = new AssetManager();
    mockLoader = (asset, _context, _options) => Promise.resolve(`loaded-${asset.name}`);
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

  test("should get loaded asset via lazy handle", async() => {
    assetManager.registry.loader(
      { type: "texture", extensions: [".png"] },
      mockLoader
    );

    const lazyAsset = assetManager.load("/test.png");
    await assetManager.loadAssets(assetManager.context);

    assert.strictEqual(lazyAsset.get(), "loaded-test");
  });

  test("should get loaded asset by path", async() => {
    assetManager.registry.loader(
      { type: "texture", extensions: [".png"] },
      mockLoader
    );

    const lazyAsset = assetManager.load("/test.png");
    await assetManager.loadAssets(assetManager.context);

    const result = assetManager.get(lazyAsset.asset.toString());
    assert.strictEqual(result, "loaded-test");
  });

  test("should throw error when getting non-existent asset", () => {
    assert.throws(
      () => assetManager.get("/non-existent.png"),
      /Asset "\/non-existent\.png" is not yet loaded/
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

    assert.strictEqual(asset1.get(), "loaded-image1");
    assert.strictEqual(asset2.get(), "loaded-image2");
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

  test("should deduplicate assets loaded from the same path", async() => {
    let loadCount = 0;
    assetManager.registry.loader(
      { type: "model", extensions: [".glb"] },
      (asset, _context) => {
        loadCount++;

        return Promise.resolve(`loaded-${asset.name}`);
      }
    );

    const handle1 = assetManager.load("/models/tree.glb");
    const handle2 = assetManager.load("/models/tree.glb");

    assert.strictEqual(assetManager.waiting.size, 1);

    await assetManager.loadAssets(assetManager.context);

    assert.strictEqual(loadCount, 1);
    assert.strictEqual(handle1.get(), "loaded-tree");
    assert.strictEqual(handle2.get(), "loaded-tree");
  });

  test("should not re-enqueue an already loaded asset", async() => {
    let loadCount = 0;
    assetManager.registry.loader(
      { type: "model", extensions: [".glb"] },
      (asset, _context) => {
        loadCount++;

        return Promise.resolve(`loaded-${asset.name}`);
      }
    );

    const handle1 = assetManager.load("/models/tree.glb");
    await assetManager.loadAssets(assetManager.context);

    // Load the same path again after it is already cached
    const handle2 = assetManager.load("/models/tree.glb");

    assert.strictEqual(assetManager.waiting.size, 0);
    assert.strictEqual(loadCount, 1);
    assert.strictEqual(handle1.get(), handle2.get());
  });

  test("should pass options to the loader callback", async() => {
    interface MyOptions {
      flipY: boolean;
    }
    let receivedOptions: MyOptions | undefined;

    assetManager.registry.loader<string, MyOptions>(
      { type: "tilemap", extensions: [".tmj"] },
      async(asset, _context, options) => {
        receivedOptions = options;

        return `loaded-${asset.name}`;
      }
    );

    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: true });
    await assetManager.loadAssets(assetManager.context);

    assert.deepStrictEqual(receivedOptions, { flipY: true });
  });

  test("should pass options through lazyLoad", async() => {
    interface MyOptions {
      baseDir: string;
    }
    let receivedOptions: MyOptions | undefined;

    assetManager.registry.loader<string, MyOptions>(
      { type: "tilemap", extensions: [".tmj"] },
      async(asset, _context, options) => {
        receivedOptions = options;

        return `loaded-${asset.name}`;
      }
    );

    const lazyLoader = assetManager.lazyLoad<string, MyOptions>();
    lazyLoader("/maps/level1.tmj", { baseDir: "assets/" });
    await assetManager.loadAssets(assetManager.context);

    assert.deepStrictEqual(receivedOptions, { baseDir: "assets/" });
  });

  test("should keep options from first call when same asset is loaded twice", async() => {
    interface MyOptions {
      flipY: boolean;
    }
    let receivedOptions: MyOptions | undefined;

    assetManager.registry.loader<string, MyOptions>(
      { type: "tilemap", extensions: [".tmj"] },
      async(asset, _context, options) => {
        receivedOptions = options;

        return `loaded-${asset.name}`;
      }
    );

    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: true });
    // Second call with different options — first call wins
    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: false });
    await assetManager.loadAssets(assetManager.context);

    assert.deepStrictEqual(receivedOptions, { flipY: true });
  });

  test("should ignore options when asset is already cached", async() => {
    interface MyOptions {
      flipY: boolean;
    }
    const receivedOptionsList: (MyOptions | undefined)[] = [];

    assetManager.registry.loader<string, MyOptions>(
      { type: "tilemap", extensions: [".tmj"] },
      async(asset, _context, options) => {
        receivedOptionsList.push(options);

        return `loaded-${asset.name}`;
      }
    );

    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: true });
    await assetManager.loadAssets(assetManager.context);

    // Asset is now cached — options on re-load are ignored
    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: false });
    await assetManager.loadAssets(assetManager.context);

    assert.strictEqual(receivedOptionsList.length, 1);
    assert.deepStrictEqual(receivedOptionsList[0], { flipY: true });
  });
});
