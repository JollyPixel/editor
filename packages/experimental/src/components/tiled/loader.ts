// Import Third-party Dependencies
import {
  Systems,
  pathUtils
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import type { TiledMap, TiledMapTileset } from "./types.js";

export interface LoadedTileSetAsset {
  tileset: TiledMapTileset;
  texture: THREE.Texture;
}

export interface LoadedTileMapAsset {
  tilemap: TiledMap;
  tilesets: Map<string, LoadedTileSetAsset>;
}

export const tiledMapLoader = Systems.Assets.registerLoader<LoadedTileMapAsset>(
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
  asset: Systems.Asset,
  context: Systems.AssetLoaderContext
): Promise<LoadedTileMapAsset> {
  const response = await fetch(asset.path + asset.basename);
  const tilemap = (await response.json()) as TiledMap;

  const textureLoader = new THREE.TextureLoader(context.manager);
  const tilesets = new Map<string, LoadedTileSetAsset>();

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
