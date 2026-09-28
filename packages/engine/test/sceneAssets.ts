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
  ids: Iterable<string> = []
): SceneAssets {
  const loader = new DeferredAssetLoader();
  const catalog = new AssetCatalog(
    Array.from(ids, (id) => new AssetRecord({
      id,
      kind: kSceneAsset.kind,
      source: `${id}.bin`
    }))
  );

  return {
    coordinator: new AssetCoordinator({
      catalog,
      loaders: new AssetLoaderRegistry().register(kSceneAsset, loader)
    }),
    loader,
    reference: (id) => new AssetReference(id, kSceneAsset)
  };
}
