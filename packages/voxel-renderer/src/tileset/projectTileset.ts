// Import Internal Dependencies
import {
  composeBlockId,
  localBlockIdOf,
  tilesetSlotOf
} from "../blocks/BlockId.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { TilesetDefinition } from "./types.ts";

// CONSTANTS
const kMaterialGroupSeparator = "/";

/**
 * The world-side identity a tileset's blocks are projected into.
 */
export type TilesetProjection = Pick<TilesetDefinition, "id"> & {
  slot: number;
};

export function projectedMaterialGroupId(
  tileset: TilesetProjection,
  groupId: string
): string {
  return `${tileset.id}${kMaterialGroupSeparator}${groupId}`;
}

/**
 * The tileset-local group id of a projected one, or the id itself when it
 * was not projected from this tileset.
 */
export function localMaterialGroupId(
  tileset: TilesetProjection,
  groupId: string
): string {
  const prefix = `${tileset.id}${kMaterialGroupSeparator}`;

  return groupId.startsWith(prefix) ? groupId.slice(prefix.length) : groupId;
}

/**
 * Gives a tileset block its world id, tileset id and material group name.
 */
export function projectTilesetBlock(
  tileset: TilesetProjection,
  block: ResolvedBlockDefinition
): ResolvedBlockDefinition {
  const projected = BlockTextures.of(block)
    .map((ref) => (
      ref.tilesetId === tileset.id ?
        ref :
        {
          ...ref,
          tilesetId: tileset.id
        }
    ))
    .applyTo(block);

  return {
    ...projected,
    id: composeBlockId(tileset.slot, block.id),
    ...(block.materialGroup === undefined ? {} : {
      materialGroup: projectedMaterialGroupId(tileset, block.materialGroup)
    })
  };
}

export function projectTilesetBlocks(
  tileset: TilesetProjection,
  blocks: Iterable<ResolvedBlockDefinition>
): ResolvedBlockDefinition[] {
  return Array.from(blocks, (block) => projectTilesetBlock(tileset, block));
}

export function projectTilesetMaterialGroup(
  tileset: TilesetProjection,
  group: MaterialGroupJSON
): MaterialGroupJSON {
  return {
    ...group,
    id: projectedMaterialGroupId(tileset, group.id)
  };
}

export function projectTilesetMaterialGroups(
  tileset: TilesetProjection,
  groups: Iterable<MaterialGroupJSON>
): MaterialGroupJSON[] {
  return Array.from(
    groups,
    (group) => projectTilesetMaterialGroup(tileset, group)
  );
}

/**
 * Whether a world block id was projected from the tileset's slot.
 */
export function belongsToTileset(
  tileset: Pick<TilesetProjection, "slot">,
  blockId: number
): boolean {
  return tilesetSlotOf(blockId) === tileset.slot;
}

/**
 * The tileset-local block of a projected one: local id, tile references
 * naming no tileset and the local material group name.
 */
export function localTilesetBlock(
  tileset: TilesetProjection,
  block: ResolvedBlockDefinition
): ResolvedBlockDefinition {
  const local = BlockTextures.of(block)
    .map((ref) => {
      if (ref.tilesetId === undefined) {
        return ref;
      }
      const { tilesetId: _tilesetId, ...rest } = ref;

      return rest;
    })
    .applyTo(block);

  return {
    ...local,
    id: localBlockIdOf(block.id),
    ...(block.materialGroup === undefined ? {} : {
      materialGroup: localMaterialGroupId(tileset, block.materialGroup)
    })
  };
}
