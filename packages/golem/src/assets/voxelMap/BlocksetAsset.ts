// Import Third-party Dependencies
import { isPixelCommand } from "@jolly-pixel/asset.pixel-art/client";
import type {
  BlocksetEditCommand,
  SyncedBlockset
} from "@jolly-pixel/asset.voxel-map/client";
import type { BlocksetEditableKind } from "@jolly-pixel/asset.voxel-map/server";
import type { PeerMetadata } from "@jolly-pixel/network/client";
import {
  BlocksetLink,
  resolveTileRect,
  type BlocksetDocumentJSON,
  type BlocksetLinkOptions,
  type BlocksetSlot,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  GolemAsset,
  type AssetOpening
} from "../GolemAsset.ts";
import { pixelCursor } from "../pixelArt/pixelCursor.ts";
import {
  PixelSurface,
  type PixelRect
} from "../pixelArt/PixelSurface.ts";

export interface BlockSummary {
  id: number;
  name: string;
  shapeId: string;
  /**
   * The texture rect each face slot draws from, with `default` for the
   * slots the block leaves to its default texture.
   */
  tiles: Record<string, PixelRect>;
}

export class BlocksetAsset extends GolemAsset<
  BlocksetEditCommand,
  SyncedBlockset
> {
  readonly pixels: PixelSurface;

  constructor(
    opening: AssetOpening,
    kind: BlocksetEditableKind
  ) {
    super(opening, kind);
    this.pixels = new PixelSurface(
      this.synced.pixels,
      (commands) => this.applyInBatches(commands)
    );
  }

  blocks(): BlockSummary[] {
    const { blockset } = this.synced;

    return Array.from(blockset.blocks, (block) => {
      const tiles: Record<string, PixelRect> = {};
      if (block.defaultTexture !== undefined) {
        tiles.default = tileRect(block.defaultTexture, blockset.tileSize);
      }
      for (const [slot, ref] of Object.entries(block.faceTextures)) {
        tiles[slot] = tileRect(ref, blockset.tileSize);
      }

      return {
        id: block.id,
        name: block.name,
        shapeId: block.shapeId,
        tiles
      };
    });
  }

  read(): BlocksetDocumentJSON {
    return this.synced.blockset.toJSON();
  }

  link(
    map: BlocksetLinkOptions["document"],
    slot: BlocksetSlot
  ): BlocksetLink {
    return new BlocksetLink({
      document: map,
      blockset: this.synced.blockset,
      slot
    });
  }

  protected focus(
    commands: readonly BlocksetEditCommand[]
  ): PeerMetadata | null {
    return pixelCursor(commands.filter(isPixelCommand));
  }
}

function tileRect(
  ref: ResolvedTileRef,
  tileSize: number
): PixelRect {
  const { x, y, width, height } = resolveTileRect(ref, tileSize);

  return {
    x,
    y,
    width,
    height
  };
}
