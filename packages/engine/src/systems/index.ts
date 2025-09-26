// Import Internal Dependencies
import {
  AssetManager,
  type AssetOnProgressCallback
} from "./Asset/Manager.js";

export * from "./Asset/Base.js";
export type {
  AssetLoaderCallback,
  AssetLoaderContext,
  AssetLoaderOptions
} from "./Asset/Registry.js";

export * from "./Loader.js";
export * from "./GameInstance.js";

export type {
  AssetOnProgressCallback
};

export const Assets = new AssetManager();
