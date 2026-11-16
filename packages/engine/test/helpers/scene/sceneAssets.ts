// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference,
  AssetType,
  type AssetLoader
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ENVIRONMENT_ASSET,
  type EnvironmentFile
} from "../../../src/core/systems/environment/EnvironmentFile.ts";

// CONSTANTS
const kSceneAsset = new AssetType<string>("scene-asset");

export class DeferredAssetLoader implements AssetLoader<string> {
  #deferreds = new Map<string, PromiseWithResolvers<string>>();

  load(
    record: AssetRecord
  ): Promise<string> {
    return this.#deferred(record.id.value).promise;
  }

  resolve(
    id: string
  ): void {
    this.#deferred(id).resolve(id);
  }

  reject(
    id: string,
    error: Error
  ): void {
    this.#deferred(id).reject(error);
  }

  #deferred(
    id: string
  ): PromiseWithResolvers<string> {
    let deferred = this.#deferreds.get(id);
    if (deferred === undefined) {
      deferred = Promise.withResolvers<string>();
      this.#deferreds.set(id, deferred);
    }

    return deferred;
  }
}

export interface SceneAssets {
  coordinator: AssetCoordinator;
  loader: DeferredAssetLoader;
  reference(id: string): AssetReference<string>;
}

export function createSceneAssets(
  ids: Iterable<string> = [],
  environments: Readonly<Record<string, EnvironmentFile>> = {}
): SceneAssets {
  const loader = new DeferredAssetLoader();
  const catalog = new AssetCatalog([
    ...Array.from(ids, (id) => new AssetRecord({
      id,
      kind: kSceneAsset.kind,
      path: `${id}.bin`
    })),
    ...Object.keys(environments).map((id) => new AssetRecord({
      id,
      kind: ENVIRONMENT_ASSET.kind,
      path: `${id}.environment`
    }))
  ]);

  return {
    coordinator: new AssetCoordinator({
      catalog,
      loaders: new AssetLoaderRegistry()
        .register(kSceneAsset, loader)
        .register(ENVIRONMENT_ASSET, {
          load: async(record) => environments[record.id.value]
        })
    }),
    loader,
    reference: (id) => new AssetReference(id, kSceneAsset)
  };
}
