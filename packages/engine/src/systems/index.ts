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

export * from "./GameInstance.js";
export * from "./Runtime.js";

export { Asset };
export type {
  AssetTypeName,
  LazyAsset,
  AssetLoaderCallback,
  AssetLoaderOptions,
  AssetLoaderContext
};

export const Assets = new AssetManager();
