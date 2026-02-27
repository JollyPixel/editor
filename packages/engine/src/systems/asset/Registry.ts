// Import Internal Dependencies
import {
  AssetLoader,
  type AssetLoaderCallback
} from "./Loader.ts";

// CONSTANTS
const kDefaultAssetType = "unknown";

export class AssetRegistry {
  #extToType = new Map<string, string>();
  #typeToLoader = new Map<string, AssetLoaderCallback<any, any>>();

  register(
    loader: AssetLoader<any, any>
  ) {
    this.#typeToLoader.set(
      loader.type,
      loader.load
    );
    for (const ext of loader.extensions) {
      this.#extToType.set(ext, loader.type);
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
