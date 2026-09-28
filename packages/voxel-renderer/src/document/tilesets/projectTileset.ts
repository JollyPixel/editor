// Import Internal Dependencies
import {
  composeBlockId,
  isLocalBlockId,
  localBlockIdOf,
  MAX_LOCAL_BLOCK_ID,
  tilesetSlotOf
} from "../blocks/BlockId.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "../blocks/BlockDefinition.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { BlendGroupJSON } from "../materials/BlendGroup.ts";
import type { TilesetDefinition } from "./types.ts";

// CONSTANTS
const kGroupSeparator = "/";

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
  return `${tileset.id}${kGroupSeparator}${groupId}`;
}

/**
 * The tileset-local group id of a projected one, or the id itself when it
 * was not projected from this tileset.
 */
export function localMaterialGroupId(
  tileset: TilesetProjection,
  groupId: string
): string {
  const prefix = `${tileset.id}${kGroupSeparator}`;

  return groupId.startsWith(prefix) ? groupId.slice(prefix.length) : groupId;
}

export function projectedBlendGroupId(
  tileset: TilesetProjection,
  groupId: string
): string {
  return projectedMaterialGroupId(tileset, groupId);
}

export function localBlendGroupId(
  tileset: TilesetProjection,
  groupId: string
): string {
  return localMaterialGroupId(tileset, groupId);
}

/**
 * Gives a tileset block its world id, tileset id and group names.
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
    }),
    ...(block.blendGroup === undefined ? {} : {
      blendGroup: projectedBlendGroupId(tileset, block.blendGroup)
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

export function projectTilesetBlendGroup(
  tileset: TilesetProjection,
  group: BlendGroupJSON
): BlendGroupJSON {
  return {
    ...group,
    id: projectedBlendGroupId(tileset, group.id),
    ...(group.exclude === undefined ? {} : {
      exclude: group.exclude.map((id) => projectedBlendGroupId(tileset, id))
    })
  };
}

export function projectTilesetBlendGroups(
  tileset: TilesetProjection,
  groups: Iterable<BlendGroupJSON>
): BlendGroupJSON[] {
  return Array.from(
    groups,
    (group) => projectTilesetBlendGroup(tileset, group)
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
 * naming no tileset and the local group names.
 */
export function localTilesetBlock(
  tileset: TilesetProjection,
  block: ResolvedBlockDefinition
): ResolvedBlockDefinition {
  return {
    ...withoutTilesets(block),
    id: localBlockIdOf(block.id),
    ...(block.materialGroup === undefined ? {} : {
      materialGroup: localMaterialGroupId(tileset, block.materialGroup)
    }),
    ...(block.blendGroup === undefined ? {} : {
      blendGroup: localBlendGroupId(tileset, block.blendGroup)
    })
  };
}

export function localBlock(
  def: BlockDefinition
): ResolvedBlockDefinition {
  if (!isLocalBlockId(def.id)) {
    throw new RangeError(
      `Block id ${def.id} is out of range (1..${MAX_LOCAL_BLOCK_ID}).`
    );
  }

  return withoutTilesets(resolveBlockDefinition(def));
}

function withoutTilesets(
  block: ResolvedBlockDefinition
): ResolvedBlockDefinition {
  return BlockTextures.of(block)
    .map((ref) => {
      if (ref.tilesetId === undefined) {
        return ref;
      }
      const { tilesetId: _tilesetId, ...local } = ref;

      return local;
    })
    .applyTo(block);
}
