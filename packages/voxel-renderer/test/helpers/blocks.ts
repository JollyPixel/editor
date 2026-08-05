// Import Internal Dependencies
import type { BlockDefinitionIn } from "../../src/blocks/BlockDefinition.ts";
import type { BlockShapeID } from "../../src/blocks/BlockShape.ts";

// CONSTANTS
export const DEFAULT_TEXTURE = { col: 0, row: 0 };

/**
 * A minimal, collidable BlockDefinitionIn for `shapeId`, with empty
 * per-face textures and DEFAULT_TEXTURE as the fallback. Callers override
 * whatever varies for their test (name, defaultTexture, collidable, ...).
 */
export function makeBlockDef(
  id: number,
  shapeId: BlockShapeID,
  overrides: Partial<BlockDefinitionIn> = {}
): BlockDefinitionIn {
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
