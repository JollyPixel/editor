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

export const TiledMapAssetLoader = new Systems.AssetLoader<
  VoxelWorldJSON,
  TiledLoaderConverterOptions
>({
  type: "tilemap",
  extensions: [".tmj"],
  load: (asset, _context, options) => tmjLoader(asset, options)
});

export function loadVoxelTiledMap(
  assetManager: Systems.AssetManager,
  pathOrAsset: VoxelTiledMapAsset | string,
  options?: TiledLoaderConverterOptions
): Systems.LazyAsset<VoxelWorldJSON, TiledLoaderConverterOptions> {
  assetManager.register(TiledMapAssetLoader);

  return assetManager.load<VoxelWorldJSON, TiledLoaderConverterOptions>(
    pathOrAsset,
    options
  );
}

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
