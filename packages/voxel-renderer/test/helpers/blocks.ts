// Import Internal Dependencies
import type { BlockDefinition } from "../../src/blocks/index.ts";
import type { BlockShapeID } from "../../src/blocks/shape/index.ts";

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
    ...overrides
  };
}
