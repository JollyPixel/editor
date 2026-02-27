// Import Node.js Dependencies
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

// Import Internal Dependencies
import { Asset } from "../../../src/systems/asset/Base.ts";
import { AssetManager } from "../../../src/systems/asset/Manager.ts";
import { AssetLoader } from "../../../src/systems/asset/Loader.ts";

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
    assetManager.register(new AssetLoader({
      type: "texture",
      extensions: [".png"],
      load: mockLoader
    }));

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
    assetManager.register(new AssetLoader({
      type: "texture",
      extensions: [".png"],
      load: mockLoader
    }));

    const lazyAsset = assetManager.load("/test.png");
    await assetManager.loadAssets(assetManager.context);

    assert.strictEqual(lazyAsset.get(), "loaded-test");
  });

  test("should get loaded asset by path", async() => {
    assetManager.register(new AssetLoader({
      type: "texture",
      extensions: [".png"],
      load: mockLoader
    }));

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
    assetManager.register(new AssetLoader({
      type: "texture",
      extensions: [".png", ".jpg"],
      load: mockLoader
    }));

    const asset1 = assetManager.load("/image1.png");
    const asset2 = assetManager.load("/image2.jpg");

    await assetManager.loadAssets(assetManager.context);

    assert.strictEqual(asset1.get(), "loaded-image1");
    assert.strictEqual(asset2.get(), "loaded-image2");
  });

  test("should call onStart callback for each asset", async() => {
    assetManager.register(new AssetLoader({
      type: "texture",
      extensions: [".png"],
      load: mockLoader
    }));

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

  test("should handle empty queue gracefully", async() => {
    // No assets loaded, should complete without error
    await assert.doesNotReject(
      () => assetManager.loadAssets(assetManager.context)
    );
  });

  test("should deduplicate assets loaded from the same path", async() => {
    let loadCount = 0;
    assetManager.register(new AssetLoader({
      type: "model",
      extensions: [".glb"],
      load: (asset, _context) => {
        loadCount++;

        return Promise.resolve(`loaded-${asset.name}`);
      }
    }));

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
    assetManager.register(new AssetLoader({
      type: "model",
      extensions: [".glb"],
      load: (asset, _context) => {
        loadCount++;

        return Promise.resolve(`loaded-${asset.name}`);
      }
    }));

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

    assetManager.register(new AssetLoader<string, MyOptions>({
      type: "tilemap",
      extensions: [".tmj"],
      load: async(asset, _context, options) => {
        receivedOptions = options;

        return `loaded-${asset.name}`;
      }
    }));

    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: true });
    await assetManager.loadAssets(assetManager.context);

    assert.deepStrictEqual(receivedOptions, { flipY: true });
  });

  test("should keep options from first call when same asset is loaded twice", async() => {
    interface MyOptions {
      flipY: boolean;
    }
    let receivedOptions: MyOptions | undefined;

    assetManager.register(new AssetLoader<string, MyOptions>({
      type: "tilemap",
      extensions: [".tmj"],
      load: async(asset, _context, options) => {
        receivedOptions = options;

        return `loaded-${asset.name}`;
      }
    }));

    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: true });
    // Second call with different options — first call wins
    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: false });
    await assetManager.loadAssets(assetManager.context);

    assert.deepStrictEqual(receivedOptions, { flipY: true });
  });

  test("register() delegates loader to registry and types the asset", async() => {
    const loader = new AssetLoader({
      type: "texture",
      extensions: [".png"],
      load: (asset, _context) => Promise.resolve(`loaded-${asset.name}`)
    });
    assetManager.register(loader);

    const lazy = assetManager.load("/test.png");
    assert.strictEqual(lazy.asset.type, "texture");
  });

  test("register() returns the AssetManager for chaining", () => {
    const loader = new AssetLoader({
      type: "texture",
      extensions: [".png"],
      load: (_asset, _context) => Promise.resolve("ok")
    });
    const result = assetManager.register(loader);
    assert.strictEqual(result, assetManager);
  });

  test("should ignore options when asset is already cached", async() => {
    interface MyOptions {
      flipY: boolean;
    }
    const receivedOptionsList: (MyOptions | undefined)[] = [];

    assetManager.register(new AssetLoader<string, MyOptions>({
      type: "tilemap",
      extensions: [".tmj"],
      load: async(asset, _context, options) => {
        receivedOptionsList.push(options);

        return `loaded-${asset.name}`;
      }
    }));

    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: true });
    await assetManager.loadAssets(assetManager.context);

    // Asset is now cached — options on re-load are ignored
    assetManager.load<string, MyOptions>("/maps/level1.tmj", { flipY: false });
    await assetManager.loadAssets(assetManager.context);

    assert.strictEqual(receivedOptionsList.length, 1);
    assert.deepStrictEqual(receivedOptionsList[0], { flipY: true });
  });

  describe("loadAsync", () => {
    test("resolves with loaded asset value", async() => {
      assetManager.register(new AssetLoader({
        type: "texture",
        extensions: [".png"],
        load: mockLoader
      }));

      const result = await assetManager.loadAsync<string>("/images/player.png");

      assert.strictEqual(result, "loaded-player");
    });

    test("resolves immediately for already-cached asset without calling loader again", async() => {
      let loadCount = 0;
      assetManager.register(new AssetLoader({
        type: "texture",
        extensions: [".png"],
        load: (asset, _context) => {
          loadCount++;

          return Promise.resolve(`loaded-${asset.name}`);
        }
      }));

      await assetManager.loadAsync("/images/sprite.png");
      assert.strictEqual(loadCount, 1);

      await assetManager.loadAsync("/images/sprite.png");
      assert.strictEqual(loadCount, 1);
    });

    test("concurrent loadAsync for same path loads only once", async() => {
      let loadCount = 0;
      assetManager.register(new AssetLoader({
        type: "texture",
        extensions: [".png"],
        load: (asset, _context) => {
          loadCount++;

          return Promise.resolve(`loaded-${asset.name}`);
        }
      }));

      const [result1, result2] = await Promise.all([
        assetManager.loadAsync("/images/shared.png"),
        assetManager.loadAsync("/images/shared.png")
      ]);

      assert.strictEqual(loadCount, 1);
      assert.strictEqual(result1, "loaded-shared");
      assert.strictEqual(result2, "loaded-shared");
    });

    test("loadAsync interop with loadAssets — does not double-load", async() => {
      let loadCount = 0;
      assetManager.register(new AssetLoader({
        type: "texture",
        extensions: [".png"],
        load: (asset, _context) => {
          loadCount++;

          return Promise.resolve(`loaded-${asset.name}`);
        }
      }));

      // load() enqueues, loadAsync() resolves immediately without waiting for loadAssets
      const lazySync = assetManager.load("/images/tile.png");
      await assetManager.loadAsync("/images/tile.png");

      assert.strictEqual(loadCount, 1);
      assert.strictEqual(lazySync.get(), "loaded-tile");

      // loadAssets drains queue (now empty) — no second load
      await assetManager.loadAssets(assetManager.context);
      assert.strictEqual(loadCount, 1);
    });

    test("sequential loading — second asset starts after first resolves", async() => {
      const order: string[] = [];
      assetManager.register(new AssetLoader({
        type: "texture",
        extensions: [".png"],
        load: (asset, _context) => {
          order.push(asset.name);

          return Promise.resolve(`loaded-${asset.name}`);
        }
      }));

      await assetManager.loadAsync("/images/a.png");
      await assetManager.loadAsync("/images/b.png");

      assert.deepStrictEqual(order, ["a", "b"]);
      assert.strictEqual(assetManager.get("/images/a.png"), "loaded-a");
      assert.strictEqual(assetManager.get("/images/b.png"), "loaded-b");
    });

    test("throws when no loader registered for asset type", async() => {
      await assert.rejects(
        () => assetManager.loadAsync("/unknown.xyz"),
        /No loader registered for asset type: unknown/
      );
    });

    test("LazyAsset.getAsync() shorthand works", async() => {
      assetManager.register(new AssetLoader({
        type: "texture",
        extensions: [".png"],
        load: mockLoader
      }));

      const lazy = assetManager.load("/images/hero.png");
      const result = await lazy.getAsync();

      assert.strictEqual(result, "loaded-hero");
    });

    test("passes options to loader via loadAsync", async() => {
      interface MyOptions {
        flipY: boolean;
      }
      let receivedOptions: MyOptions | undefined;

      assetManager.register(new AssetLoader<string, MyOptions>({
        type: "tilemap",
        extensions: [".tmj"],
        load: async(asset, _context, options) => {
          receivedOptions = options;

          return `loaded-${asset.name}`;
        }
      }));

      await assetManager.loadAsync<string, MyOptions>("/maps/world.tmj", { flipY: true });

      assert.deepStrictEqual(receivedOptions, { flipY: true });
    });
  });
});
