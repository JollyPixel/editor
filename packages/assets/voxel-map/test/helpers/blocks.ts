// Import Third-party Dependencies
import type {
  BlockDefinition,
  BlockShapeID
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const DEFAULT_TEXTURE = {
  col: 0,
  row: 0
};

export function makeBlockDef(
  id: number,
  shapeId: BlockShapeID,
  overrides: Partial<BlockDefinition> = {}
): BlockDefinition {
  return {
    id,
    name: shapeId,
    shapeId,
    faceTextures: {},
    defaultTexture: DEFAULT_TEXTURE,
    collidable: true,
    properties: {},
    ...overrides
  };
}
