// Import Internal Dependencies
import {
  AssetManager,
  type AssetOnProgressCallback
} from "./asset_bis/Manager.js";

export * from "./asset_bis/Base.js";
export type {
  AssetLoaderCallback,
  AssetLoaderContext,
  AssetLoaderOptions
} from "./asset_bis/Registry.js";

export * from "./GameInstance.js";
export * from "./rendering/index.js";
export * from "./Scene.js";

export type {
  AssetOnProgressCallback
};

export const Assets = new AssetManager();
