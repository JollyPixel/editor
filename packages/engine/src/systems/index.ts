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

export * from "./World.ts";
export * from "./Scene.ts";
export * from "./FixedTimeStep.ts";
export * from "./rendering/index.ts";
export * from "./SceneManager.ts";
export * from "./generators/IntegerIncrement.ts";
export * from "./generators/PersistentIdIncrement.ts";

export type {
  AssetOnProgressCallback
};

export const Assets = new AssetManager();
