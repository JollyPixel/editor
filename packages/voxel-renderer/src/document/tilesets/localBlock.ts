// Import Internal Dependencies
import {
  isLocalBlockId,
  MAX_LOCAL_BLOCK_ID
} from "../blocks/BlockId.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "../blocks/BlockDefinition.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";

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

export function withoutTilesets(
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
