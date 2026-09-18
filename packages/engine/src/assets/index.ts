// Import Internal Dependencies
import {
  ModelAssetLoader,
  ModelAssetType
} from "./model.ts";
import {
  FontAssetLoader,
  FontAssetType
} from "./font.ts";

export * from "./audio.ts";
export * from "./texture.ts";
export {
  ModelAssetLoader,
  ModelAssetType,
  type Model
} from "./model.ts";
export {
  FontAssetLoader,
  FontAssetType,
  type Font
} from "./font.ts";

export const AssetLoaders = {
  model: ModelAssetLoader,
  font: FontAssetLoader
} as const;

export const AssetTypes = {
  model: ModelAssetType,
  font: FontAssetType
} as const;
