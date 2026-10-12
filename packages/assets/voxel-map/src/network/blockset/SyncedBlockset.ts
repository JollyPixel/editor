// Import Third-party Dependencies
import {
  blankPixelDocument,
  type SyncedPixelDocumentOptions
} from "@jolly-pixel/asset.pixel-art/client";
import type { PendingChanges } from "@jolly-pixel/network/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { BlocksetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BLOCKSET_KIND } from "../../asset/blockset.ts";
import { BlocksetSyncClient } from "./BlocksetSyncClient.ts";
import type { BlocksetRoom } from "./types.ts";

export type SyncedBlocksetOptions = SyncedPixelDocumentOptions;

export class SyncedBlockset {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;
  readonly ready: Promise<void>;

  #sync: BlocksetSyncClient;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  get pendingChanges(): PendingChanges {
    return this.#sync;
  }

  constructor(
    room: BlocksetRoom,
    options: SyncedBlocksetOptions = {}
  ) {
    this.pixels = blankPixelDocument(options);
    this.blockset = new BlocksetDocument();
    this.#sync = new BlocksetSyncClient({
      room,
      pixels: this.pixels,
      blockset: this.blockset
    });
    this.ready = this.#sync.whenReady();
  }

  dispose(): void {
    this.#sync.destroy();
    this.blockset.dispose();
  }
}

export interface SyncedBlocksetLease {
  document: SyncedBlockset;
  ready: Promise<void>;
  pendingChanges: PendingChanges;
  dispose(): void;
}

export interface BlocksetDocumentKind {
  readonly kind: typeof BLOCKSET_KIND;
  createDocument(
    room: BlocksetRoom
  ): SyncedBlocksetLease;
}

export function blocksetDocumentKind(
  options: SyncedBlocksetOptions = {}
): BlocksetDocumentKind {
  return {
    kind: BLOCKSET_KIND,
    createDocument: (room) => {
      const blockset = new SyncedBlockset(room, options);

      return {
        document: blockset,
        ready: blockset.ready,
        pendingChanges: blockset.pendingChanges,
        dispose: () => blockset.dispose()
      };
    }
  };
}
