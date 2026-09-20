// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  type VoxelEngine,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { UVMap } from "@jolly-pixel/pixel-draw.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { BrushStore } from "../../../../src/state/index.ts";
import type { MapDocumentEvents } from "../../../../src/document/index.ts";

export interface FakeBridgeOptions {
  brush: BrushStore;
  mapDocument: Emitter<MapDocumentEvents>;
}

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
    properties: {},
    faceTextures: {},
    defaultTexture: { ...placement }
  };
}

export function makeFakeVoxelEngine(): {
  engine: VoxelEngine;
  dirtyReasons: string[];
  bridgeOptions: FakeBridgeOptions;
} {
  const dirtyReasons: string[] = [];
  const bridgeOptions: FakeBridgeOptions = {
    brush: new BrushStore(),
    mapDocument: new Emitter<MapDocumentEvents>()
  };
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
        bridgeOptions.mapDocument.emit("blockRegistryChanged");
      }
      dirtyReasons.push("block-defined");
    },
    markAllChunksDirty: (reason: string) => {
      dirtyReasons.push(reason);
    }
  };

  return {
    engine: fake as unknown as VoxelEngine,
    dirtyReasons,
    bridgeOptions
  };
}

export function makeUv(): UVMap {
  return new UVMap({
    getCanvasSize: () => {
      return { x: 256, y: 256 };
    }
  });
}
