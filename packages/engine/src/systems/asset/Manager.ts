// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  Asset,
  type LazyAsset
} from "./Base.ts";
import { AssetQueue } from "./Queue.ts";
import {
  AssetRegistry
} from "./Registry.ts";
import {
  AssetLoader,
  type AssetLoaderContext
} from "./Loader.ts";
import {
  Logger
} from "../Logger.ts";

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
  #pendingPromises: Map<string, Promise<void>> = new Map();
  #logger: Logger;

  constructor(
    logger?: Logger
  ) {
    this.#logger = (
      logger ?? new Logger()
    ).child({ namespace: "Systems.AssetManager" });
  }

  register(
    loader: AssetLoader<any, any>
  ): this {
    this.registry.register(loader);

    return this;
  }

  load<TReturn = unknown, TOptions = unknown>(
    assetOrPath: Asset<TReturn, TOptions> | string,
    options?: TOptions
  ): LazyAsset<TReturn, TOptions> {
    const asset = Asset.from(assetOrPath);
    if (asset.type === "unknown") {
      asset.type = this.registry.getTypeForExt(asset.longExt);
    }

    const key = asset.toString();
    this.#logger.debug("Requesting asset load", {
      asset: key,
      type: asset.type,
      options
    });

    if (!this.assets.has(key)) {
      this.waiting.enqueue(asset);
      if (options !== undefined && !this.#pendingOptions.has(key)) {
        this.#pendingOptions.set(key, options);
      }
      this.scheduleAutoload(this.context);
    }

    return {
      asset,
      get: () => this.get<TReturn>(key),
      getAsync: () => this.loadAsync<TReturn, TOptions>(asset)
    };
  }

  async loadAsync<TReturn = unknown, TOptions = unknown>(
    assetOrPath: Asset<TReturn, TOptions> | string,
    options?: TOptions
  ): Promise<TReturn> {
    const asset = Asset.from(assetOrPath);
    if (asset.type === "unknown") {
      asset.type = this.registry.getTypeForExt(asset.longExt);
    }

    const key = asset.toString();

    if (this.assets.has(key)) {
      return this.get<TReturn>(key);
    }

    if (this.#pendingPromises.has(key)) {
      await this.#pendingPromises.get(key)!;

      return this.get<TReturn>(key);
    }

    if (options !== undefined && !this.#pendingOptions.has(key)) {
      this.#pendingOptions.set(key, options);
    }

    const loader = this.registry.getLoaderForType<TReturn, TOptions>(asset.type);
    if (!loader) {
      throw new Error(`No loader registered for asset type: ${asset.type}`);
    }

    const pendingOptions = this.#pendingOptions.get(key) as TOptions | undefined;
    this.#pendingOptions.delete(key);

    const promise = loader(asset, this.context, pendingOptions)
      .then((result) => {
        this.assets.set(key, result);
        this.#pendingPromises.delete(key);
      })
      .catch((cause) => {
        this.#pendingPromises.delete(key);

        throw new Error(`Failed to load asset "${key}"`, { cause });
      });

    this.#pendingPromises.set(key, promise);
    await promise;

    return this.get<TReturn>(key);
  }

  get<TReturn>(
    path: string
  ): TReturn {
    this.#logger.debug("Retrieving asset", { asset: path });

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
          .catch((error) => this.#logger.error("Failed to load assets", { error }));
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
    this.#logger.info("Starting asset loading", {
      count: assets.length
    });

    const loadAsset = async(asset: Asset): Promise<void> => {
      const key = asset.toString();

      if (this.assets.has(key)) {
        return;
      }

      if (this.#pendingPromises.has(key)) {
        await this.#pendingPromises.get(key)!;

        return;
      }

      const loader = this.registry.getLoaderForType(asset.type);
      if (!loader) {
        this.#logger.error(`No loader registered for asset type: ${asset.type}`, {
          asset: key
        });

        throw new Error(`No loader registered for asset type: ${asset.type}`);
      }

      onStart?.(asset);

      const pendingOptions = this.#pendingOptions.get(key);
      this.#pendingOptions.delete(key);

      const promise = loader(asset, context, pendingOptions)
        .then((result) => {
          this.assets.set(key, result);
          this.#pendingPromises.delete(key);
        })
        .catch((cause) => {
          this.#pendingPromises.delete(key);
          this.#logger.error(`Failed to load asset "${key}"`, { cause });

          throw new Error(`Failed to load asset "${key}"`, { cause });
        });

      this.#pendingPromises.set(key, promise);
      await promise;
    };

    await Promise.all(
      assets.map((asset) => loadAsset(asset))
    );
  }
}
