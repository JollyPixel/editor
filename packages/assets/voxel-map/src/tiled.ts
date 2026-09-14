// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord,
  type AssetReference
} from "@jolly-pixel/asset";
import {
  loadJSON,
  pathUtils
} from "@jolly-pixel/engine";
import type * as THREE from "three";
import {
  TiledConverter,
  type TiledConverterOptions,
  type TiledMap
} from "@jolly-pixel/voxel.renderer/plugins/tiled/index.ts";
import {
  loadTilesets,
  type TilesetSource,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

export type TiledMapAssetLoaderOptions = Omit<
  TiledConverterOptions,
  "resolveTilesetSrc"
>;

export interface VoxelTiledMap {
  readonly world: VoxelWorldJSON;
  readonly tilesets: TilesetSource[];
}

export const TiledMapAssetType = new AssetType<VoxelTiledMap>("tilemap");

export type VoxelTiledMapAsset = AssetReference<VoxelTiledMap>;

/**
 * Loads a Tiled map and prepares its textures as one runtime asset.
 */
export class TiledMapAssetLoader implements AssetLoader<VoxelTiledMap> {
  #manager: THREE.LoadingManager | undefined;
  #options: TiledMapAssetLoaderOptions;

  constructor(
    manager?: THREE.LoadingManager,
    options: TiledMapAssetLoaderOptions = {}
  ) {
    this.#manager = manager;
    this.#options = {
      ...options
    };
  }

  async load(
    record: AssetRecord
  ): Promise<VoxelTiledMap> {
    const source = pathUtils.parse(record.source);
    const tilemap = await loadJSON<TiledMap>(record.source);

    const world = new TiledConverter().convert(
      tilemap,
      {
        resolveTilesetSrc: (src) => source.dir + src.replace(/\.tsx$/, ".png"),
        layerMode: "stacked",
        ...this.#options
      }
    );
    const tilesets = await loadTilesets(world.tilesets, {
      manager: this.#manager
    });

    return {
      world,
      tilesets
    };
  }
}
