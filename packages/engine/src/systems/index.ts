// Import Internal Dependencies
import {
  AssetManager,
  type AssetOnProgressCallback
} from "./asset/Manager.js";

export * from "./asset/Base.js";
export type {
  AssetLoaderCallback,
  AssetLoaderContext,
  AssetLoaderOptions
} from "./asset/Registry.js";

export * from "./GameInstance.js";
export * from "./renderers/index.js";
export * from "./Scene.js";

export type {
  AssetOnProgressCallback
};

export const Assets = new AssetManager();
