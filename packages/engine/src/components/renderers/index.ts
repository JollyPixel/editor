export * from "./sprite/SpriteRenderer.class.ts";
export * from "./model/ModelRenderer.ts";
export * from "./text/TextRenderer.class.ts";

// Import Internal Dependencies
import {
  ModelAssetLoader,
  ModelAssetType,
  type Model
} from "./model/loader.ts";
import {
  FontAssetLoader,
  FontAssetType,
  type Font
} from "./text/loader.ts";

export const AssetLoaders = {
  model: ModelAssetLoader,
  font: FontAssetLoader
} as const;

export const AssetTypes = {
  model: ModelAssetType,
  font: FontAssetType
} as const;

export type {
  Model,
  Font
};
