// Import Third-party Dependencies
import {
  BlocksetLink,
  BlocksetSlot,
  type BlocksetDefinition,
  type VoxelDocument,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { VoxelMapSource } from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import { BlocksetAtlasBridge } from "../viewer/BlocksetAtlasBridge.ts";
import { BlocksetSurface } from "../viewer/BlocksetSurface.ts";
import type { GameBlockset } from "./GameBlockset.ts";

export interface GameVoxelMapBlockset {
  readonly definition: BlocksetDefinition & { slot: number; };
  readonly loaded: GameBlockset;
}

interface LinkedSurface {
  readonly definition: BlocksetDefinition;
  readonly link: BlocksetLink;
  readonly surface: BlocksetSurface;
}

export class GameVoxelMap implements VoxelMapSource {
  readonly document: VoxelDocument;

  #surfaces: readonly LinkedSurface[];

  constructor(
    document: VoxelDocument,
    blocksets: Iterable<GameVoxelMapBlockset>
  ) {
    this.document = document;
    this.#surfaces = Array.from(blocksets, ({ definition, loaded }) => {
      return {
        definition,
        link: new BlocksetLink({
          document,
          blockset: loaded.blockset,
          slot: new BlocksetSlot({
            id: definition.id,
            slot: definition.slot
          })
        }),
        surface: new BlocksetSurface(loaded)
      };
    });
  }

  attach(
    view: VoxelView
  ): () => void {
    const bridges = this.#surfaces.map(
      ({ definition, surface }) => new BlocksetAtlasBridge({
        view,
        surface,
        definition
      })
    );

    return () => {
      for (const bridge of bridges) {
        bridge.destroy();
      }
    };
  }
}
