// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  Asset,
  type LazyAsset
} from "./Base.ts";
import { AssetQueue } from "./Queue.ts";
import {
  AssetRegistry,
  type AssetLoaderContext
} from "./Registry.ts";

export type AssetOnProgressCallback = (
  progress: number,
  max: number
) => void;

export interface LoadAssetsOptions {
  onStart?: (asset: Asset) => void;
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
      asset.type = this.registry.getTypeForExt(asset.longExt);
    }

    const path = asset.toString();

    if (!this.assets.has(path)) {
      this.waiting.enqueue(asset);
      this.scheduleAutoload(this.context);
    }

    return {
      asset,
      get: () => this.get<T>(path)
    };
  }

  lazyLoad<T = unknown>(): (assetOrPath: Asset | string) => LazyAsset<T> {
    return (assetOrPath) => this.load<T>(assetOrPath);
  }

  get<T>(
    path: string
  ): T {
    if (this.assets.has(path)) {
      return this.assets.get(path) as T;
    }

    throw new Error(`Asset "${path}" is not yet loaded.`);
  }

  scheduleAutoload(
    context: AssetLoaderContext
  ) {
    if (context) {
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

    const { onStart } = options;

    const loadAsset = async(asset: Asset): Promise<void> => {
      const loader = this.registry.getLoaderForType(asset.type);
      if (!loader) {
        throw new Error(`No loader registered for asset type: ${asset.type}`);
      }

      onStart?.(asset);

      try {
        const result = await loader(asset, context);
        this.assets.set(asset.toString(), result);
      }
      catch (cause) {
        throw new Error(`Failed to load asset "${asset.toString()}"`, { cause });
      }
    };

    const loadingPromises = assets.map((asset) => loadAsset(asset));
    await Promise.all(loadingPromises);
  }
}
