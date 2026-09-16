// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockShapeID,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const DEFAULT_BLOCK_NAME = "New Block";
const kDraftPreviewId = -1;

export interface BlockDraft {
  name: string;
  shapeId: BlockShapeID;
  tilesetId: string;
}

export function blockDefinitionFromDraft(
  draft: BlockDraft,
  id: number
): BlockDefinition {
  return {
    id,
    name: draft.name.trim() || DEFAULT_BLOCK_NAME,
    shapeId: draft.shapeId,
    defaultTexture: {
      tilesetId: draft.tilesetId || undefined,
      col: 0,
      row: 0
    }
  };
}

export function previewBlockFromDraft(
  draft: BlockDraft
): ResolvedBlockDefinition {
  return resolveBlockDefinition(
    blockDefinitionFromDraft(draft, kDraftPreviewId)
  );
}
