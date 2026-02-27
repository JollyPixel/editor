export * from "./sprite/SpriteRenderer.class.ts";
export * from "./model/ModelRenderer.ts";
export * from "./text/TextRenderer.class.ts";

// Import Internal Dependencies
import {
  ModelAssetLoader,
  type Model
} from "./model/loader.ts";
import {
  FontAssetLoader,
  type Font
} from "./text/loader.ts";

export const Loaders = {
  model: ModelAssetLoader,
  font: FontAssetLoader
} as const;

export type {
  Model,
  Font
};
