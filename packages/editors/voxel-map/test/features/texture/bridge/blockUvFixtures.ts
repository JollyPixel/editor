// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  type VoxelEngine,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { UVMap } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { editorState } from "../../../../src/app/state/index.ts";

export interface BlockTexturePlacement {
  col: number;
  row: number;
  tilesetId: string;
}

export function makeBlock(
  id: number,
  placement: BlockTexturePlacement
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures: {},
    defaultTexture: { ...placement }
  };
}

export function makeFakeVoxelEngine(): {
  engine: VoxelEngine;
  dirtyReasons: string[];
} {
  const dirtyReasons: string[] = [];
  const registry = new BlockRegistry();
  const fake = {
    blockRegistry: registry,
    shapeRegistry: BlockShapeRegistry.createDefault(),
    defineBlock: (def: ResolvedBlockDefinition) => {
      fake.defineBlocks([def]);
    },
    defineBlocks: (defs: Iterable<ResolvedBlockDefinition>) => {
      const resolved = [...defs];
      if (resolved.length === 0) {
        return;
      }

      for (const def of resolved) {
        registry.register(def);
        editorState.world.emit("blockRegistryChanged");
      }
      dirtyReasons.push("block-defined");
    },
    markAllChunksDirty: (reason: string) => {
      dirtyReasons.push(reason);
    }
  };

  return {
    engine: fake as unknown as VoxelEngine,
    dirtyReasons
  };
}

export function makeUv(): UVMap {
  return new UVMap({
    getCanvasSize: () => {
      return { x: 256, y: 256 };
    }
  });
}
