// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  TilesetSlot,
  type VoxelView,
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
  view: VoxelView;
  dirtyReasons: string[];
  bridgeOptions: FakeBridgeOptions;
} {
  const dirtyReasons: string[] = [];
  const bridgeOptions: FakeBridgeOptions = {
    brush: new BrushStore(),
    mapDocument: new Emitter<MapDocumentEvents>()
  };
  const registry = new BlockRegistry();
  const document = {
    blocks: registry,
    defineBlock: (def: ResolvedBlockDefinition) => {
      document.defineBlocks([def]);
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
    }
  };
  const fake = {
    document,
    shapes: BlockShapeRegistry.createDefault(),
    markAllChunksDirty: (reason: string) => {
      dirtyReasons.push(reason);
    }
  };

  return {
    view: fake as unknown as VoxelView,
    dirtyReasons,
    bridgeOptions
  };
}

export function tilesetSlot(
  id: string,
  slot = 0
): TilesetSlot {
  return new TilesetSlot({
    id,
    slot
  });
}

export function makeUv(): UVMap {
  return new UVMap({
    getCanvasSize: () => {
      return { x: 256, y: 256 };
    }
  });
}
