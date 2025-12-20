export * from "./sprite/SpriteRenderer.class.ts";
export * from "./tiled/TileMapRenderer.ts";
export * from "./model/ModelRenderer.ts";
export * from "./text/TextRenderer.class.ts";

// Import Internal Dependencies
import {
  tiledMap,
  type TiledSetAsset,
  type TiledMapAsset
} from "./tiled/loader.ts";
import {
  model,
  type Model
} from "./model/loader.ts";
import {
  font,
  type Font
} from "./text/loader.ts";

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
