export * from "./sprite/SpriteRenderer.class.js";
export * from "./tiled/TileMapRenderer.js";
export * from "./model/ModelRenderer.js";
export * from "./text/TextRenderer.class.js";

// Import Internal Dependencies
import {
  tiledMap,
  type TiledSetAsset,
  type TiledMapAsset
} from "./tiled/loader.js";
import {
  model,
  type Model
} from "./model/loader.js";
import {
  font,
  type Font
} from "./text/loader.js";

export const Loaders = {
  tiledMap,
  model,
  font
} as const;

export type {
  TiledSetAsset,
  TiledMapAsset,
  Model,
  Font
};
