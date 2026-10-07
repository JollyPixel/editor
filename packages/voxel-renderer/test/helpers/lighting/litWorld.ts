// Import Internal Dependencies
import { VoxelDocument } from "../../../src/document/VoxelDocument.ts";
import { BlockShapeRegistry } from "../../../src/document/blocks/shape/BlockShapeRegistry.ts";
import type { MaterialGroupJSON } from "../../../src/document/materials/index.ts";
import type { VoxelCoord } from "../../../src/document/world/types.ts";
import { VoxelLayerVisibility } from "../../../src/view/VoxelLayerVisibility.ts";
import { BlockLightSources } from "../../../src/view/lighting/BlockLightSources.ts";
import { BlockLightField } from "../../../src/view/lighting/BlockLightField.ts";
import { makeBlockDef } from "../blocks.ts";

// CONSTANTS
export const STONE_ID = 1;
export const GLOW_ID = 2;
export const SLAB_ID = 3;
export const GLASS_ID = 4;

export interface LitWorld {
  document: VoxelDocument;
  sources: BlockLightSources;
  field: BlockLightField;
  visibility: VoxelLayerVisibility;
  place: (position: VoxelCoord, blockId: number) => void;
  remove: (position: VoxelCoord) => void;
}

export function litWorld(
  options: {
    chunkSize?: number;
    glow?: Omit<MaterialGroupJSON, "id">;
    layers?: string[];
  } = {}
): LitWorld {
  const {
    chunkSize = 16,
    glow = { lightLevel: 15 },
    layers = ["Ground"]
  } = options;
  const document = new VoxelDocument({
    chunkSize,
    layers,
    blocks: [
      makeBlockDef(STONE_ID, "cube"),
      makeBlockDef(GLOW_ID, "cube", { materialGroup: "glow" }),
      makeBlockDef(SLAB_ID, "slab"),
      makeBlockDef(GLASS_ID, "cube", { alphaMode: "blend" })
    ],
    materialGroups: [{ id: "glow", ...glow }]
  });
  const visibility = new VoxelLayerVisibility();
  const sources = new BlockLightSources({
    blocks: document.blocks,
    shapes: BlockShapeRegistry.createDefault(),
    materialGroups: document.materialGroups
  });
  const field = new BlockLightField({
    world: document.world,
    sources,
    visibility
  });

  return {
    document,
    sources,
    field,
    visibility,
    place: (position, blockId) => {
      document.world.setVoxel(layers[0], {
        position,
        blockId
      });
    },
    remove: (position) => {
      document.world.removeVoxel(layers[0], { position });
    }
  };
}
