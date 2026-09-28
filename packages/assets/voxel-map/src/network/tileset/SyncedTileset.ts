// Import Third-party Dependencies
import {
  blankPixelDocument,
  type SyncedPixelDocumentOptions
} from "@jolly-pixel/asset.pixel-art/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { TilesetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TILESET_KIND } from "../../asset/tileset.ts";
import { TilesetSyncClient } from "./TilesetSyncClient.ts";
import type { TilesetRoom } from "./types.ts";

export type SyncedTilesetOptions = SyncedPixelDocumentOptions;

export class SyncedTileset {
  readonly pixels: PixelDocument;
  readonly tileset: TilesetDocument;
  readonly ready: Promise<void>;

  #sync: TilesetSyncClient;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  constructor(
    room: TilesetRoom,
    options: SyncedTilesetOptions = {}
  ) {
    this.pixels = blankPixelDocument(options);
    this.tileset = new TilesetDocument();
    this.#sync = new TilesetSyncClient({
      room,
      pixels: this.pixels,
      tileset: this.tileset
    });
    this.ready = this.#sync.whenReady();
  }

  dispose(): void {
    this.#sync.destroy();
    this.tileset.dispose();
  }
}

export interface SyncedTilesetLease {
  document: SyncedTileset;
  ready: Promise<void>;
  dispose(): void;
}

export interface TilesetDocumentKind {
  readonly kind: typeof TILESET_KIND;
  createDocument(
    room: TilesetRoom
  ): SyncedTilesetLease;
}

export function tilesetDocumentKind(
  options: SyncedTilesetOptions = {}
): TilesetDocumentKind {
  return {
    kind: TILESET_KIND,
    createDocument: (room) => {
      const tileset = new SyncedTileset(room, options);

      return {
        document: tileset,
        ready: tileset.ready,
        dispose: () => tileset.dispose()
      };
    }
  };
}
