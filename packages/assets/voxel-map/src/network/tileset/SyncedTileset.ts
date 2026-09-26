// Import Third-party Dependencies
import {
  PixelDocument,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import { TilesetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TILESET_KIND } from "../../asset/tileset.ts";
import { TilesetSyncClient } from "./TilesetSyncClient.ts";
import type { TilesetRoom } from "./types.ts";

// CONSTANTS
const kInitialSize: Vec2 = { x: 1, y: 1 };

export interface SyncedTilesetOptions {
  maxSize?: number;
  history?: {
    enabled?: boolean;
    limit?: number;
  };
}

/**
 * A tileset's pixels and document together with the client that keeps them
 * in step with the room. Holders edit `pixels` and `tileset`; the room
 * belongs to the lease.
 */
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
    this.pixels = new PixelDocument({
      size: kInitialSize,
      maxSize: options.maxSize,
      history: options.history
    });
    this.tileset = new TilesetDocument();
    this.#sync = new TilesetSyncClient({
      room,
      pixels: this.pixels,
      tileset: this.tileset
    });
    this.ready = new Promise((resolve) => {
      this.#sync.once("ready", resolve);
    });
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
