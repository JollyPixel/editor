// Import Internal Dependencies
import type { TiledMapTileset } from "./types.ts";

// CONSTANTS
export const FLIPPED_HORIZONTAL = 0x80000000;
export const FLIPPED_VERTICAL = 0x40000000;
export const FLIPPED_ANTI_DIAGONAL = 0x20000000;
export const TILED_FLIPPED_FLAGS =
  FLIPPED_HORIZONTAL |
  FLIPPED_VERTICAL |
  FLIPPED_ANTI_DIAGONAL;

export interface TileProps {
  coords: {
    x: number;
    y: number;
  };
  uv: {
    size: {
      x: number;
      y: number;
    };
    offset: {
      x: number;
      y: number;
    };
  };
  flippedX: boolean;
  flippedY: boolean;
  flippedAD: boolean;
}

/**
 * Pure-data wrapper around a Tiled tileset entry.
 *
 * Converts GIDs (Global tile IDs) to local coordinates and UV regions.
 * No Three.js or browser dependency — safe to use in Node.js build tools.
 * UV values are normalised (0–1 per tile), independent of actual image size.
 */
export class TileSet {
  static find(
    tilesets: TileSet[],
    tileId: number
  ): TileSet | null {
    return tilesets
      .sort((a, b) => a.firstgid - b.firstgid)
      .find((tileSet) => tileSet.containsGid(tileId)) ?? null;
  }

  #metadata: TiledMapTileset;

  constructor(
    tiledset: TiledMapTileset
  ) {
    this.#metadata = tiledset;
  }

  get name(): string {
    return this.#metadata.name;
  }

  get firstgid(): number {
    return this.#metadata.firstgid;
  }

  get lastgid(): number {
    return this.#metadata.firstgid + this.#metadata.tilecount - 1;
  }

  get tilewidth(): number {
    return this.#metadata.tilewidth;
  }

  get tileheight(): number {
    return this.#metadata.tileheight;
  }

  get columns(): number {
    return this.#metadata.columns;
  }

  get rows(): number {
    return this.#metadata.tilecount / this.#metadata.columns;
  }

  containsGid(
    gid: number
  ): boolean {
    return this.containsLocalId(this.getTileLocalId(gid));
  }

  containsLocalId(
    index: number
  ): boolean {
    return index >= 0 && index < this.#metadata.tilecount;
  }

  getTileLocalId(
    gid: number
  ): number {
    return (gid & ~TILED_FLIPPED_FLAGS) - this.#metadata.firstgid;
  }

  getTileProperties(
    gid: number
  ): TileProps | null {
    const localId = this.getTileLocalId(gid);
    if (!this.containsLocalId(localId)) {
      return null;
    }

    const cols = this.#metadata.columns;
    const rows = this.#metadata.tilecount / cols;

    const coords = {
      x: localId % cols,
      y: Math.floor(localId / cols)
    };

    // Normalised UV (0–1 per tile), Y-flipped for WebGL origin.
    const uvX = coords.x / cols;
    const uvY = 1.0 - (coords.y + 1) / rows;

    return {
      coords,
      uv: {
        size: {
          x: 1 / cols,
          y: 1 / rows
        },
        offset: {
          x: uvX,
          y: uvY
        }
      },
      flippedX: (gid & FLIPPED_HORIZONTAL) !== 0,
      flippedY: (gid & FLIPPED_VERTICAL) !== 0,
      flippedAD: (gid & FLIPPED_ANTI_DIAGONAL) !== 0
    };
  }
}
