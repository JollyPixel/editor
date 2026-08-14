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
import { TilesetLoader } from "../../tileset/TilesetLoader.ts";

export type TiledMapAssetLoaderOptions = Omit<
  TiledConverterOptions,
  "resolveTilesetSrc"
>;

export interface VoxelTiledMap {
  readonly world: VoxelWorldJSON;
  readonly tilesetLoader: TilesetLoader;
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
    const tilesetLoader = new TilesetLoader({
      manager: this.#manager
    });
    await tilesetLoader.fromWorld(world);

    return {
      world,
      tilesetLoader
    };
  }
}
