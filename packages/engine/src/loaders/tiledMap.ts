// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  Assets,
  type Asset,
  type AssetLoaderContext
} from "../systems/index.js";
import { loadJSON } from "../utils/loadJSON.js";
import * as pathUtils from "../utils/path.js";
import type {
  TiledMap,
  TiledMapTileset
} from "../renderers/tiled/types.js";

export interface TiledSetAsset {
  tileset: TiledMapTileset;
  texture: THREE.Texture;
}

export interface TiledMapAsset {
  tilemap: TiledMap;
  tilesets: Map<string, TiledSetAsset>;
}

export const tiledMap = Assets.registerLoader<TiledMapAsset>(
  {
    extensions: [".tmj"],
    type: "tilemap"
  },
  (asset, context) => {
    switch (asset.ext) {
      case ".tmj":
        return tmjLoader(asset, context);
      default:
        throw new Error(`Unsupported model type: ${asset.ext}`);
    }
  }
);

async function tmjLoader(
  asset: Asset,
  context: AssetLoaderContext
): Promise<TiledMapAsset> {
  const tilemap = await loadJSON<TiledMap>(asset.path + asset.basename);

  const textureLoader = new THREE.TextureLoader(context.manager);
  const tilesets = new Map<string, TiledSetAsset>();

  for (const tileset of tilemap.tilesets) {
    if (tileset.source) {
      const fileName = pathUtils.parse(tileset.source).name;
      const texture = await textureLoader.loadAsync(asset.path + fileName + ".png");
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;

      tilesets.set(tileset.name ?? fileName, {
        tileset,
        texture
      });
    }
  }

  return {
    tilemap,
    tilesets
  };
}
