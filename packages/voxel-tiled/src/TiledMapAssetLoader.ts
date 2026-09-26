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
import {
  loadTilesets,
  type ResolvedBlockDefinition,
  type TilesetSource,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type * as THREE from "three";

// Import Internal Dependencies
import {
  TiledConverter,
  type TiledConverterOptions
} from "./TiledConverter.ts";
import type { TiledMap } from "./types.ts";

export type TiledMapAssetLoaderOptions = Omit<
  TiledConverterOptions,
  "resolveTilesetSrc"
>;

export interface VoxelTiledMap {
  readonly world: VoxelWorldJSON;
  readonly blocks: ResolvedBlockDefinition[];
  readonly tilesets: TilesetSource[];
}

export const TiledMapAssetType = new AssetType<VoxelTiledMap>("tilemap");

export type VoxelTiledMapAsset = AssetReference<VoxelTiledMap>;

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

    const { world, blocks } = new TiledConverter().convert(
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
      blocks,
      tilesets
    };
  }
}
