// Import Internal Dependencies
import {
  Asset,
  AssetManager,
  type AssetTypeName,
  type LazyAsset,
  type AssetLoaderContext,
  type AssetLoaderCallback,
  type AssetLoaderOptions
} from "./Asset.js";

export * from "./Loader.js";
export * from "./GameInstance.js";

export { Asset };
export type {
  AssetTypeName,
  LazyAsset,
  AssetLoaderCallback,
  AssetLoaderOptions,
  AssetLoaderContext
};

export const Assets = new AssetManager();
