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
  context: AssetLoaderContext = {
    manager: new THREE.LoadingManager()
  };

  autoload = false;
  #hasAutoloadTimeout = false;
  #pendingOptions: Map<string, unknown> = new Map();

  load<TReturn = unknown, TOptions = unknown>(
    assetOrPath: Asset<TReturn, TOptions> | string,
    options?: TOptions
  ): LazyAsset<TReturn, TOptions> {
    const asset = Asset.from(assetOrPath);
    if (asset.type === "unknown") {
      asset.type = this.registry.getTypeForExt(asset.longExt);
    }

    const key = asset.toString();

    if (!this.assets.has(key)) {
      this.waiting.enqueue(asset);
      if (options !== undefined && !this.#pendingOptions.has(key)) {
        this.#pendingOptions.set(key, options);
      }
      this.scheduleAutoload(this.context);
    }

    return {
      asset,
      get: () => this.get<TReturn>(key)
    };
  }

  lazyLoad<TReturn = unknown, TOptions = unknown>(): (
  assetOrPath: Asset<TReturn, TOptions> | string,
  options?: TOptions
  ) => LazyAsset<TReturn, TOptions> {
    return (assetOrPath, options) => this.load<TReturn, TOptions>(assetOrPath, options);
  }

  get<TReturn>(
    path: string
  ): TReturn {
    if (this.assets.has(path)) {
      return this.assets.get(path) as TReturn;
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
        const key = asset.toString();
        const pendingOptions = this.#pendingOptions.get(key);
        this.#pendingOptions.delete(key);

        const result = await loader(asset, context, pendingOptions);
        this.assets.set(key, result);
      }
      catch (cause) {
        throw new Error(`Failed to load asset "${asset.toString()}"`, { cause });
      }
    };

    const loadingPromises = assets.map((asset) => loadAsset(asset));
    await Promise.all(loadingPromises);
  }
}
