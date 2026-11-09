// Import Third-party Dependencies
import {
  AssetReference,
  type AssetLoadContext,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import {
  VoxelDocument,
  parseVoxelWorld
} from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import {
  GAME_BLOCKSET,
  type GameBlockset
} from "./GameBlockset.ts";
import {
  GameVoxelMap,
  type GameVoxelMapBlockset
} from "./GameVoxelMap.ts";

export class VoxelMapLoader implements AssetLoader<GameVoxelMap> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<GameVoxelMap> {
    const loader = new THREE.FileLoader(this.#manager);
    const text = await loader.loadAsync(record.path.toString());
    const document = new VoxelDocument();
    document.load(parseVoxelWorld(JSON.parse(String(text))));

    const blocksets = await Promise.all(
      Array.from(document.blocksets, async(definition) => {
        const { asset, slot } = definition;
        if (asset === undefined || slot === undefined) {
          return null;
        }

        const loaded: GameBlockset = await context.assets.load(
          new AssetReference(asset.id, GAME_BLOCKSET)
        );

        return {
          definition: {
            ...definition,
            slot
          },
          loaded
        } satisfies GameVoxelMapBlockset;
      })
    );

    return new GameVoxelMap(
      document,
      blocksets.filter((blockset) => blockset !== null)
    );
  }
}
