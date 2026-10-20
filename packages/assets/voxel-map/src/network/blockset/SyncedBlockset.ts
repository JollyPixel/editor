// Import Third-party Dependencies
import {
  blankPixelDocument,
  type SyncedPixelDocumentOptions
} from "@jolly-pixel/asset.pixel-art/client";
import { SyncedDocument } from "@jolly-pixel/network/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { BlocksetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BLOCKSET_KIND } from "../../asset/blockset.ts";
import { BlocksetSyncClient } from "./BlocksetSyncClient.ts";
import type { BlocksetRoom } from "./types.ts";

export type SyncedBlocksetOptions = SyncedPixelDocumentOptions;

export class SyncedBlockset extends SyncedDocument<SyncedBlockset> {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;

  get document(): this {
    return this;
  }

  constructor(
    room: BlocksetRoom,
    options: SyncedBlocksetOptions = {}
  ) {
    const pixels = blankPixelDocument(options);
    const blockset = new BlocksetDocument();
    super(new BlocksetSyncClient({
      room,
      pixels,
      blockset
    }));
    this.pixels = pixels;
    this.blockset = blockset;
  }

  override dispose(): void {
    super.dispose();
    this.blockset.dispose();
  }
}

export interface BlocksetDocumentKind {
  readonly kind: typeof BLOCKSET_KIND;
  createDocument(
    room: BlocksetRoom
  ): SyncedBlockset;
}

export function blocksetDocumentKind(
  options: SyncedBlocksetOptions = {}
): BlocksetDocumentKind {
  return {
    kind: BLOCKSET_KIND,
    createDocument: (room) => new SyncedBlockset(room, options)
  };
}
