// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderAlreadyExistsError,
  AssetRecord,
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  SoundAssetLoader,
  SoundAssetType,
  FontAssetLoader,
  FontAssetType,
  JSONFileAssetLoader,
  ModelAssetLoader,
  ModelAssetType,
  SceneFileAssetType,
  TEXTURE_ASSET,
  TextureAssetLoader,
  createDefaultAssetLoaders
} from "../../src/assets/index.ts";

describe("createDefaultAssetLoaders", () => {
  test("registers a loader for every built-in asset type", () => {
    const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());

    assert.strictEqual(loaders.size, 6);
    assert.ok(loaders.get(ModelAssetType) instanceof ModelAssetLoader);
    assert.ok(loaders.get(FontAssetType) instanceof FontAssetLoader);
    assert.ok(loaders.get(SoundAssetType) instanceof SoundAssetLoader);
    assert.ok(loaders.get(TEXTURE_ASSET) instanceof TextureAssetLoader);
    assert.ok(loaders.get(SceneFileAssetType) instanceof JSONFileAssetLoader);
    assert.ok(loaders.get(Systems.ENVIRONMENT_ASSET) instanceof JSONFileAssetLoader);
  });

  test("registers custom loaders built with the same loading manager", async() => {
    const manager = new THREE.LoadingManager();
    const custom = new AssetType<string>("custom");
    let receivedManager: THREE.LoadingManager | undefined;

    const loaders = createDefaultAssetLoaders(manager, {
      loaders: [
        {
          type: custom,
          create: (loaderManager) => {
            receivedManager = loaderManager;

            return {
              load: async() => "loaded"
            };
          }
        }
      ]
    });

    assert.strictEqual(receivedManager, manager);
    const coordinator = new AssetCoordinator({
      catalog: new AssetCatalog([
        new AssetRecord({
          id: "custom.value",
          kind: "custom",
          path: "custom/value.txt"
        })
      ]),
      loaders
    });
    assert.strictEqual(
      await coordinator.load(new AssetReference("custom.value", custom)),
      "loaded"
    );
  });

  test("rejects a custom loader for a kind the built-in loaders handle", () => {
    assert.throws(
      () => createDefaultAssetLoaders(new THREE.LoadingManager(), {
        loaders: [
          {
            type: ModelAssetType,
            create: (manager) => new ModelAssetLoader(manager)
          }
        ]
      }),
      AssetLoaderAlreadyExistsError
    );
  });

  test("loads .ktx2 textures through the given KTX2 loader", async() => {
    const requested: string[] = [];
    const loaders = createDefaultAssetLoaders(new THREE.LoadingManager(), {
      ktx2: {
        loadAsync: async(url) => {
          requested.push(url);

          return new THREE.CompressedTexture([], 16, 16);
        }
      }
    });

    const coordinator = new AssetCoordinator({
      catalog: new AssetCatalog([
        new AssetRecord({
          id: "texture.grass",
          kind: "texture",
          path: "textures/grass.ktx2"
        })
      ]),
      loaders
    });

    const texture = await coordinator.load(
      new AssetReference("texture.grass", TEXTURE_ASSET)
    );

    assert.deepStrictEqual(requested, ["textures/grass.ktx2"]);
    assert.ok(texture instanceof THREE.CompressedTexture);
  });
});
