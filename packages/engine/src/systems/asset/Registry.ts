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

export type AssetLoaderCallback<T = unknown> = (asset: Asset, context: AssetLoaderContext) => Promise<T>;

export class AssetRegistry {
  #extToType = new Map<string, string>();
  #typeToLoader = new Map<string, AssetLoaderCallback>();

  loader(
    options: AssetLoaderOptions,
    loader: AssetLoaderCallback
  ) {
    this.#typeToLoader.set(options.type, loader);
    for (const ext of options.extensions) {
      this.#extToType.set(ext, options.type);
    }
  }

  getTypeForExt(ext: string) {
    return this.#extToType.get(ext) ?? kDefaultAssetType;
  }

  getLoaderForType(type: string) {
    return this.#typeToLoader.get(type);
  }
}
