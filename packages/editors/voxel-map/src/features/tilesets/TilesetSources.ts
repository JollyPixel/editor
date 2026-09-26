// Import Third-party Dependencies
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { TilesetDocument } from "@jolly-pixel/voxel.renderer";
import {
  tilesetDocumentKind,
  type TilesetRoom
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import type { AssetLeases } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { TilesetEntry } from "../../state/index.ts";

// CONSTANTS
export const TILESET_MAX_SIZE = 2048;
export const TILESET_DOCUMENT_KIND = tilesetDocumentKind({
  maxSize: TILESET_MAX_SIZE,
  history: {
    enabled: true
  }
});

/**
 * A tileset asset opened for editing: its pixels, its document and the room
 * both are synced through.
 */
export interface OpenedTileset {
  readonly pixels: PixelDocument;
  readonly tileset: TilesetDocument;
  readonly room: TilesetRoom;
  readonly ready: Promise<void>;
  release(): void;
}

export interface TilesetSources {
  open(entry: TilesetEntry): OpenedTileset | null;
}

export class SessionTilesetSources implements TilesetSources {
  readonly #assets: AssetLeases;

  constructor(
    assets: AssetLeases
  ) {
    this.#assets = assets;
  }

  open(
    entry: TilesetEntry
  ): OpenedTileset | null {
    if (entry.assetId === null) {
      return null;
    }

    const lease = this.#assets.open(TILESET_DOCUMENT_KIND, entry.assetId);

    return {
      pixels: lease.document.pixels,
      tileset: lease.document.tileset,
      room: lease.room,
      ready: lease.ready,
      release: () => lease.release()
    };
  }
}
