// Import Third-party Dependencies
import {
  Systems,
  loadJSON
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  TiledMap
} from "./types.ts";
import {
  TiledConverter,
  type TiledConverterOptions
} from "./TiledConverter.ts";
import type {
  VoxelWorldJSON
} from "../../serialization/VoxelSerializer.ts";

type TiledLoaderConverterOptions = Omit<TiledConverterOptions, "resolveTilesetSrc">;

export type VoxelTiledMapAsset = Systems.Asset<VoxelWorldJSON, TiledLoaderConverterOptions>;

Systems.Assets.registry.loader<VoxelWorldJSON, TiledLoaderConverterOptions>(
  {
    extensions: [".tmj"],
    type: "tilemap"
  },
  (asset, _context, options) => {
    switch (asset.ext) {
      case ".tmj":
        return tmjLoader(asset, options);
      default:
        throw new Error(`Unsupported model type: ${asset.ext}`);
    }
  }
);

export const loadVoxelTiledMap = Systems.Assets.lazyLoad<VoxelWorldJSON, TiledLoaderConverterOptions>();

async function tmjLoader(
  asset: VoxelTiledMapAsset,
  options: TiledLoaderConverterOptions = {}
): Promise<VoxelWorldJSON> {
  const tilemap = await loadJSON<TiledMap>(asset.path + asset.basename);

  const worldJson = new TiledConverter()
    .convert(
      tilemap,
      {
        resolveTilesetSrc: (src) => asset.path + src.replace(/\.tsx$/, ".png"),
        layerMode: "stacked",
        ...options
      }
    );

  return worldJson;
}
