// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  type VoxelRenderer,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { UVMap } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { editorState } from "../../../src/EditorState.ts";

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

export function makeFakeVoxelRenderer(): {
  vr: VoxelRenderer;
  dirtyReasons: string[];
} {
  const dirtyReasons: string[] = [];
  const registry = new BlockRegistry();
  const fake = {
    engine: {
      blockRegistry: registry,
      shapeRegistry: BlockShapeRegistry.createDefault(),
      defineBlock: (def: ResolvedBlockDefinition) => {
        fake.engine.defineBlocks([def]);
      },
      defineBlocks: (defs: Iterable<ResolvedBlockDefinition>) => {
        const resolved = [...defs];
        if (resolved.length === 0) {
          return;
        }

        for (const def of resolved) {
          registry.register(def);
          editorState.dispatchBlockRegistryChanged();
        }
        dirtyReasons.push("block-defined");
      },
      markAllChunksDirty: (reason: string) => {
        dirtyReasons.push(reason);
      }
    }
  };

  return { vr: fake as unknown as VoxelRenderer, dirtyReasons };
}

export function makeUv(): UVMap {
  return new UVMap({
    getCanvasSize: () => {
      return { x: 256, y: 256 };
    }
  });
}
