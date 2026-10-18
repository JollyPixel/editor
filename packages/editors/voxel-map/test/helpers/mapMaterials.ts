// Import Third-party Dependencies
import {
  BlocksetDocument,
  BlocksetLink,
  BlocksetSlot,
  composeBlockId,
  VoxelDocument,
  type BlockDefinition,
  type MaterialGroup
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapMaterials } from "../../src/features/materials/MapMaterials.ts";

// CONSTANTS
export const TERRAIN_SLOT = new BlocksetSlot({ id: "terrain", slot: 1 });
export const ROCK_SLOT = new BlocksetSlot({ id: "rock", slot: 2 });
export const GRASS_ID = composeBlockId(1, 1);
export const DIRT_ID = composeBlockId(1, 2);
export const SAND_ID = composeBlockId(1, 3);
export const STONE_ID = composeBlockId(2, 1);

export function block(
  id: number,
  materialGroup?: string
): BlockDefinition {
  return {
    id,
    name: `block-${id}`,
    shapeId: "cube",
    ...(materialGroup === undefined ? {} : { materialGroup })
  };
}

function blockOwner(
  links: BlocksetLink[],
  blockId: number
): BlocksetLink | undefined {
  return links.find((link) => link.slot.ownsBlockId(blockId));
}

function groupOwner(
  links: BlocksetLink[],
  groupId: string
): BlocksetLink | undefined {
  return links.find((link) => link.slot.decodeLocalGroupId(groupId) !== null);
}

export function setupMaterials(
  blocks: BlockDefinition[],
  groups: MaterialGroup[] = []
) {
  const document = new VoxelDocument();
  const links = [TERRAIN_SLOT, ROCK_SLOT].map((slot) => new BlocksetLink({
    document,
    blockset: new BlocksetDocument(),
    slot
  }));
  for (const group of groups) {
    groupOwner(links, group.id)?.defineMaterialGroup(group.toJSON());
  }
  for (const definition of blocks) {
    blockOwner(links, definition.id)?.defineBlock(definition);
  }

  const materials = new MapMaterials({
    document,
    blocksets: {
      findOwner: (blockId) => blockOwner(links, blockId),
      defineBlock: (definition) => blockOwner(links, definition.id)?.defineBlock(definition) ?? false,
      defineMaterialGroup: (group) => (
        groupOwner(links, group.id)?.defineMaterialGroup(group.toJSON()) ?? false
      ),
      removeMaterialGroup: (id) => groupOwner(links, id)?.removeMaterialGroup(id) ?? false,
      renameMaterialGroup: (id, to) => groupOwner(links, id)?.renameMaterialGroup(id, to) ?? false
    }
  });

  return { document, materials };
}
