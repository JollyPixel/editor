// Import Third-party Dependencies
import type {
  BlockDefinition,
  BlockShapeID
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kDefaultShapeId: BlockShapeID = "cube";

export interface CreateBlockOptions {
  id: number;
  name: string;
  shapeId?: BlockShapeID;
  tilesetId?: string;
}

/**
 * Lowest free identifier above every registered block, never 0 (air).
 */
export function nextBlockId(
  blocks: Iterable<BlockDefinition>
): number {
  let highest = 0;
  for (const block of blocks) {
    if (block.id > highest) {
      highest = block.id;
    }
  }

  return highest + 1;
}

/**
 * A new block always lands on tile (0, 0) of its tileset. The paint tab owns
 * the UV region from there, and `transparent` is derived from the atlas
 * pixels, so neither is configurable here.
 */
export function createBlockDefinition({
  id,
  name,
  shapeId = kDefaultShapeId,
  tilesetId
}: CreateBlockOptions): BlockDefinition {
  return {
    id,
    name,
    shapeId,
    collidable: true,
    faceTextures: {},
    defaultTexture: {
      tilesetId,
      col: 0,
      row: 0
    }
  };
}
