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
import { ENVIRONMENT_ASSET } from "../../src/core/systems/environment/index.ts";
import {
  AUDIO_ASSET,
  AudioAssetLoader,
  EnvironmentFileAssetLoader,
  FontAssetLoader,
  FontAssetType,
  ModelAssetLoader,
  ModelAssetType,
  SceneFileAssetLoader,
  SceneFileAssetType,
  TEXTURE_ASSET,
  TextureAssetLoader,
  createDefaultAssetLoaders
} from "../../src/three/assets/index.ts";

describe("createDefaultAssetLoaders", () => {
  test("registers a loader for every built-in asset type", () => {
    const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());

    assert.strictEqual(loaders.size, 6);
    assert.ok(loaders.get(ModelAssetType) instanceof ModelAssetLoader);
    assert.ok(loaders.get(FontAssetType) instanceof FontAssetLoader);
    assert.ok(loaders.get(AUDIO_ASSET) instanceof AudioAssetLoader);
    assert.ok(loaders.get(TEXTURE_ASSET) instanceof TextureAssetLoader);
    assert.ok(loaders.get(SceneFileAssetType) instanceof SceneFileAssetLoader);
    assert.ok(loaders.get(ENVIRONMENT_ASSET) instanceof EnvironmentFileAssetLoader);
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
