// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetLoaderAlreadyExistsError,
  AssetRecord,
  AssetType
} from "@jolly-pixel/asset";
import {
  AssetTypes,
  AssetLoaders,
  AUDIO_ASSET,
  TEXTURE_ASSET
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  createRuntimeAssetCoordinator
} from "../../src/assets/createRuntimeAssetCoordinator.ts";

describe("createRuntimeAssetCoordinator", () => {
  test("registers the default engine asset loaders", () => {
    const coordinator = createRuntimeAssetCoordinator(
      new THREE.LoadingManager(),
      new AssetCatalog()
    );

    assert.strictEqual(
      coordinator.loaders.has(AssetTypes.model),
      true
    );
    assert.strictEqual(
      coordinator.loaders.has(AssetTypes.font),
      true
    );
    assert.strictEqual(
      coordinator.loaders.has(AUDIO_ASSET),
      true
    );
    assert.strictEqual(
      coordinator.loaders.has(TEXTURE_ASSET),
      true
    );
  });

  test("adds custom loaders using the runtime loading manager", () => {
    const catalog = new AssetCatalog();
    const manager = new THREE.LoadingManager();
    const customType = new AssetType<string>("custom");
    let receivedManager: THREE.LoadingManager | undefined;
    const coordinator = createRuntimeAssetCoordinator(
      manager,
      catalog,
      {
        loaders: [
          {
            type: customType,
            create: (loaderManager) => {
              receivedManager = loaderManager;

              return {
                load: async() => "loaded"
              };
            }
          }
        ]
      }
    );

    assert.strictEqual(coordinator.catalog, catalog);
    assert.strictEqual(receivedManager, manager);
    assert.strictEqual(
      coordinator.loaders.has(customType),
      true
    );
  });

  test("rejects custom loaders that duplicate a default kind", () => {
    assert.throws(
      () => createRuntimeAssetCoordinator(
        new THREE.LoadingManager(),
        new AssetCatalog(),
        {
          loaders: [
            {
              type: AssetTypes.model,
              create: (manager) => new AssetLoaders.model(manager)
            }
          ]
        }
      ),
      AssetLoaderAlreadyExistsError
    );
  });

  test("loads .ktx2 textures through the given KTX2 loader", async() => {
    const requested: string[] = [];
    const coordinator = createRuntimeAssetCoordinator(
      new THREE.LoadingManager(),
      new AssetCatalog(),
      {
        ktx2: {
          loadAsync: async(url) => {
            requested.push(url);

            return new THREE.CompressedTexture([], 16, 16);
          }
        }
      }
    );

    const texture = await coordinator.loaders.get(TEXTURE_ASSET).load(
      new AssetRecord({
        id: "texture.grass",
        kind: "texture",
        source: "textures/grass.ktx2"
      }),
      {}
    );

    assert.deepStrictEqual(requested, ["textures/grass.ktx2"]);
    assert.ok(texture instanceof THREE.CompressedTexture);
  });
});
