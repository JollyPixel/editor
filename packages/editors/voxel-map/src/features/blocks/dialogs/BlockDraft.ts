// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockShapeID,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TilePosition } from "../../blocksets/TileOccupancy.ts";

// CONSTANTS
export const DEFAULT_BLOCK_NAME = "New Block";
const kDraftPreviewId = -1;
const kFirstTile: TilePosition = {
  col: 0,
  row: 0
};

export interface BlockDraftOptions {
  name: string;
  shapeId: BlockShapeID;
  blocksetId: string;
  size?: number;
}

export class BlockDraft {
  static create(
    blocksetId: string
  ): BlockDraft {
    return new BlockDraft({
      name: DEFAULT_BLOCK_NAME,
      shapeId: "cube",
      blocksetId
    });
  }

  readonly name: string;
  readonly shapeId: BlockShapeID;
  readonly blocksetId: string;
  readonly size: number | undefined;

  constructor(
    options: BlockDraftOptions
  ) {
    this.name = options.name;
    this.shapeId = options.shapeId;
    this.blocksetId = options.blocksetId;
    this.size = options.size;

    Object.freeze(this);
  }

  with(
    patch: Partial<BlockDraftOptions>
  ): BlockDraft {
    const { size, ...rest } = {
      name: this.name,
      shapeId: this.shapeId,
      blocksetId: this.blocksetId,
      size: this.size,
      ...patch
    };

    return new BlockDraft(size === undefined ? rest : { ...rest, size });
  }

  toDefinition(
    id: number,
    position: TilePosition = kFirstTile
  ): BlockDefinition {
    const defaultTexture: ResolvedTileRef = {
      blocksetId: this.blocksetId || undefined,
      col: position.col,
      row: position.row
    };
    if (this.size !== undefined) {
      defaultTexture.size = this.size;
    }

    return {
      id,
      name: this.name.trim() || DEFAULT_BLOCK_NAME,
      shapeId: this.shapeId,
      defaultTexture
    };
  }

  preview(): ResolvedBlockDefinition {
    return resolveBlockDefinition(this.toDefinition(kDraftPreviewId));
  }
}
