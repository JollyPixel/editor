// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  Asset,
  type AssetTypeName
} from "./Base.ts";

// CONSTANTS
const kDefaultAssetType = "unknown";

export type AssetLoaderContext = {
  manager: THREE.LoadingManager;
};

export interface AssetLoaderOptions {
  extensions: Iterable<string>;
  type: AssetTypeName;
}

export type AssetLoaderCallback<TReturn = unknown, TOptions = unknown> = (
  asset: Asset<TReturn, TOptions>,
  context: AssetLoaderContext,
  options?: TOptions
) => Promise<TReturn>;

export class AssetRegistry {
  #extToType = new Map<string, string>();
  #typeToLoader = new Map<string, AssetLoaderCallback<any, any>>();

  loader<TReturn = unknown, TOptions = unknown>(
    options: AssetLoaderOptions,
    loader: AssetLoaderCallback<TReturn, TOptions>
  ) {
    this.#typeToLoader.set(options.type, loader);
    for (const ext of options.extensions) {
      this.#extToType.set(ext, options.type);
    }
  }

  getTypeForExt(
    ext: string
  ) {
    return this.#extToType.get(ext) ?? kDefaultAssetType;
  }

  getLoaderForType<TReturn = unknown, TOptions = unknown>(
    type: string
  ): AssetLoaderCallback<TReturn, TOptions> | undefined {
    return this.#typeToLoader.get(type);
  }
}
