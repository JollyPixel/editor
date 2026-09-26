// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockShapeID,
  type ResolvedBlockDefinition
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

export function makeResolvedBlockDef(
  id: number,
  shapeId: BlockShapeID,
  overrides: Partial<BlockDefinition> = {}
): ResolvedBlockDefinition {
  return resolveBlockDefinition(makeBlockDef(id, shapeId, overrides));
}
