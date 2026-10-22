// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetLoaderAlreadyExistsError,
  AssetRecord,
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";
import {
  AssetTypes,
  AssetLoaders,
  TEXTURE_ASSET
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  createRuntimeAssetCoordinator
} from "../../src/assets/createRuntimeAssetCoordinator.ts";

describe("createRuntimeAssetCoordinator", () => {
  test("adds custom loaders using the runtime loading manager", async() => {
    const catalog = new AssetCatalog([
      new AssetRecord({
        id: "custom.value",
        kind: "custom",
        path: "custom/value.txt"
      })
    ]);
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

    assert.strictEqual(
      await coordinator.load(new AssetReference("custom.value", customType)),
      "loaded"
    );
    assert.strictEqual(receivedManager, manager);
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
      new AssetCatalog([
        new AssetRecord({
          id: "texture.grass",
          kind: "texture",
          path: "textures/grass.ktx2"
        })
      ]),
      {
        ktx2: {
          loadAsync: async(url) => {
            requested.push(url);

            return new THREE.CompressedTexture([], 16, 16);
          }
        }
      }
    );

    const texture = await coordinator.load(
      new AssetReference("texture.grass", TEXTURE_ASSET)
    );

    assert.deepStrictEqual(requested, ["textures/grass.ktx2"]);
    assert.ok(texture instanceof THREE.CompressedTexture);
  });
});
