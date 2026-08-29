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

export function createBlockDefinition(
  options: CreateBlockOptions
): BlockDefinition {
  const {
    id,
    name,
    shapeId = kDefaultShapeId,
    tilesetId
  } = options;

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
