// Import Internal Dependencies
import type { BlockDefinition } from "../../src/blocks/BlockDefinition.ts";
import type { BlockShapeID } from "../../src/blocks/shape/BlockShape.ts";

// CONSTANTS
export const DEFAULT_TEXTURE = { col: 0, row: 0 };

/**
 * A minimal, collidable BlockDefinition for `shapeId`, with empty
 * per-face textures and DEFAULT_TEXTURE as the fallback. Callers override
 * whatever varies for their test (name, defaultTexture, collidable, ...).
 */
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
