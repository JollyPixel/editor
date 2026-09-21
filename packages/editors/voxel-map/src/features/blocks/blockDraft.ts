// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockShapeID,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TilePosition } from "../tilesets/blockTilesets.ts";

// CONSTANTS
export const DEFAULT_BLOCK_NAME = "New Block";
const kDraftPreviewId = -1;
const kFirstTile: TilePosition = {
  col: 0,
  row: 0
};

export interface BlockDraft {
  name: string;
  shapeId: BlockShapeID;
  tilesetId: string;
  size?: number;
}

export function blockDefinitionFromDraft(
  draft: BlockDraft,
  id: number,
  position: TilePosition = kFirstTile
): BlockDefinition {
  const defaultTexture: ResolvedTileRef = {
    tilesetId: draft.tilesetId || undefined,
    col: position.col,
    row: position.row
  };
  if (draft.size !== undefined) {
    defaultTexture.size = draft.size;
  }

  return {
    id,
    name: draft.name.trim() || DEFAULT_BLOCK_NAME,
    shapeId: draft.shapeId,
    defaultTexture
  };
}

export function previewBlockFromDraft(
  draft: BlockDraft
): ResolvedBlockDefinition {
  return resolveBlockDefinition(
    blockDefinitionFromDraft(draft, kDraftPreviewId)
  );
}
