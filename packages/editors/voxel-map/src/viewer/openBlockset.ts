// Import Third-party Dependencies
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetDocument } from "@jolly-pixel/voxel.renderer";
import {
  blocksetDocumentKind,
  type BlocksetRoom
} from "@jolly-pixel/asset.voxel-map/client";
import type { AssetLeases } from "@jolly-pixel/editor.host";

// CONSTANTS
export const BLOCKSET_DOCUMENT_KIND = blocksetDocumentKind({
  maxSize: 2048
});

export interface OpenedBlockset {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;
  readonly room: BlocksetRoom;
  readonly ready: Promise<void>;
  release(): void;
}

export function openBlockset(
  assets: AssetLeases,
  assetId: string
): OpenedBlockset {
  const lease = assets.open(BLOCKSET_DOCUMENT_KIND, assetId);

  return {
    pixels: lease.document.pixels,
    blockset: lease.document.blockset,
    room: lease.room,
    ready: lease.ready,
    release: () => lease.release()
  };
}
