// Import Internal Dependencies
import {
  AssetManager,
  type AssetOnProgressCallback
} from "./asset/Manager.ts";

export * from "./asset/Base.ts";
export type {
  AssetLoaderCallback,
  AssetLoaderContext,
  AssetLoaderOptions
} from "./asset/Registry.ts";

export * from "./GameInstance.ts";
export * from "./FixedTimeStep.ts";
export * from "./rendering/index.ts";
export * from "./Scene.ts";

export type {
  AssetOnProgressCallback
};

export const Assets = new AssetManager();
