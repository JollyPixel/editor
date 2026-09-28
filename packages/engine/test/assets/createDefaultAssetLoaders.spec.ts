// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  AssetLoaderAlreadyExistsError,
  AssetType
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  AUDIO_ASSET,
  AudioAssetLoader,
  FontAssetLoader,
  FontAssetType,
  ModelAssetLoader,
  ModelAssetType,
  TEXTURE_ASSET,
  TextureAssetLoader,
  createDefaultAssetLoaders
} from "../../src/assets/index.ts";

describe("createDefaultAssetLoaders", () => {
  test("registers a loader for every built-in asset type", () => {
    const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());

    assert.strictEqual(loaders.size, 4);
    assert.ok(loaders.get(ModelAssetType) instanceof ModelAssetLoader);
    assert.ok(loaders.get(FontAssetType) instanceof FontAssetLoader);
    assert.ok(loaders.get(AUDIO_ASSET) instanceof AudioAssetLoader);
    assert.ok(loaders.get(TEXTURE_ASSET) instanceof TextureAssetLoader);
  });

  test("returns a registry that accepts further kinds only", () => {
    const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());
    const custom = new AssetType<string>("custom");

    loaders.register(custom, {
      load: async() => "value"
    });

    assert.strictEqual(loaders.has(custom), true);
    assert.throws(
      () => loaders.register(TEXTURE_ASSET, new TextureAssetLoader(
        new THREE.LoadingManager()
      )),
      AssetLoaderAlreadyExistsError
    );
  });
});
