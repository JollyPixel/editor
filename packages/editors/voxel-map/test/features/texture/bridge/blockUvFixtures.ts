// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  BlocksetSlot,
  type VoxelView,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { UVMap } from "@jolly-pixel/pixel-draw.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { BlockSelection } from "../../../../src/state/index.ts";
import type { MapDocumentEvents } from "../../../../src/document/MapDocument.ts";

export interface FakeBridgeOptions {
  block: BlockSelection;
  mapDocument: Emitter<MapDocumentEvents>;
}

export interface BlockTexturePlacement {
  col: number;
  row: number;
  blocksetId: string;
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
    block: new BlockSelection(),
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
        bridgeOptions.mapDocument.emit("blockRegistryChanged", "redefined");
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

export function blocksetSlot(
  id: string,
  slot = 0
): BlocksetSlot {
  return new BlocksetSlot({
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
