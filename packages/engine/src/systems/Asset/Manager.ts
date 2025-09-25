// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  Asset,
  type LazyAsset
} from "./Base.js";
import { AssetQueue } from "./Queue.js";
import {
  AssetRegistry,
  type AssetLoaderContext
} from "./Registry.js";

export type AssetOnProgressCallback = (
  progress: number,
  max: number
) => void;

export interface LoadAssetsOptions {
  onLoad?: (asset: Asset) => void;
  onProgress?: AssetOnProgressCallback;
}

export class AssetManager {
  registry = new AssetRegistry();
  waiting = new AssetQueue();
  assets: Map<string, unknown> = new Map();
  context: AssetLoaderContext = { manager: new THREE.LoadingManager() };

  autoload = false;
  #hasAutoloadTimeout = false;

  load<T = unknown>(
    assetOrPath: Asset | string
  ): LazyAsset<T> {
    const asset = Asset.from(assetOrPath);
    if (asset.type === "unknown") {
      asset.type = this.registry.getTypeForExt(asset.ext);
    }

    this.waiting.enqueue(asset);
    this.scheduleAutoload(this.context);

    return {
      asset,
      get: () => this.get<T>(asset.id)
    };
  }

  lazyLoad<T = unknown>(): (assetOrPath: Asset | string) => LazyAsset<T> {
    return (assetOrPath) => this.load<T>(assetOrPath);
  }

  get<T>(
    id: string
  ): T {
    if (this.assets.has(id)) {
      return this.assets.get(id) as T;
    }

    throw new Error(`Asset with id ${id} not found.`);
  }

  scheduleAutoload(
    context: AssetLoaderContext
  ) {
    if (this.context) {
      this.context = context;
    }

    if (this.autoload && !this.#hasAutoloadTimeout) {
      this.#hasAutoloadTimeout = true;
      setTimeout(() => {
        this.loadAssets(this.context)
          .catch(console.error);
        this.#hasAutoloadTimeout = false;
      });
    }

    return this;
  }

  async loadAssets(
    context: AssetLoaderContext,
    options: LoadAssetsOptions = {}
  ): Promise<void> {
    const assets = this.waiting.dequeueAll();
    if (assets.length === 0) {
      return;
    }
    const max = assets.length;
    const { onProgress, onLoad } = options;

    for (let index = 0; index < max; index++) {
      const asset = assets[index];
      const loader = this.registry.getLoaderForType(asset.type);
      if (!loader) {
        throw new Error(`No loader registered for asset type: ${asset.type}`);
      }

      onLoad?.(asset);
      const result = await loader(asset, context);
      onProgress?.(index + 1, max);
      this.assets.set(asset.id, result);
    }
  }
}
