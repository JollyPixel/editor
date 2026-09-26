// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  createPixelArtDocument,
  createPixelBufferFromPng,
  serializePixelBuffer,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileset,
  DEFAULT_TILE_SIZE,
  TilesetDocument,
  type BlockDefinition,
  type MaterialGroupJSON,
  type ResolvedBlockDefinition,
  type TilesetAssetReference
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const TILESET_KIND = "tileset";
export const TILESET_COMMAND = "tileset.command";
export const TILESET_EXTENSION = ".tileset.json";
export const TILESET_DOCUMENT_VERSION = 1;
const kDefaultGridSize = 8;
const kDefaultBlockLimit = 32;

export const TILESET_ASSET: AssetKindDescriptor = {
  kind: TILESET_KIND,
  label: "Tileset",
  icon: {
    svg: `
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="1.5"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        class="tone-ink"
        d="M9 3v18M15 3v18M3 9h18M3 15h18"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
      />
    `,
    tone: "amber"
  }
};

/**
 * The stored form of a tileset: its pixels, tile size, blocks and material
 * groups. Blocks carry tileset-local ids and tile references naming no
 * tileset.
 */
export interface TilesetAssetDocument {
  version: typeof TILESET_DOCUMENT_VERSION;
  tileSize: number;
  pixels: PixelArtDocumentData;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
}

export interface TilesetDocumentOptions {
  /**
   * @default 32
   */
  tileSize?: number;
  /**
   * Blank pixels of this size when `pixels` is absent.
   * @default 8 by 8 tiles
   */
  size?: Vec2;
  pixels?: PixelArtDocumentData;
  blocks?: Iterable<BlockDefinition>;
  materialGroups?: Iterable<MaterialGroupJSON>;
}

export interface TilesetFromPngOptions {
  /**
   * @default 32
   */
  tileSize?: number;
  /**
   * Maximum number of cube blocks generated from the tiles, row-major.
   * @default 32
   */
  blockLimit?: number;
}

export function tilesetAsset(
  assetId: string
): TilesetAssetReference {
  return {
    id: assetId,
    kind: TILESET_KIND
  };
}

export function createTilesetDocument(
  options: TilesetDocumentOptions = {}
): TilesetAssetDocument {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    blocks = [],
    materialGroups = []
  } = options;
  const pixels = options.pixels ?? createPixelArtDocument(
    options.size ?? {
      x: kDefaultGridSize * tileSize,
      y: kDefaultGridSize * tileSize
    }
  );
  const document = new TilesetDocument({
    tileSize,
    blocks,
    materialGroups
  });

  return {
    version: TILESET_DOCUMENT_VERSION,
    pixels,
    ...document.toJSON()
  };
}

/**
 * Wraps a PNG as a tileset with one cube block per tile.
 */
export async function tilesetDocumentFromPng(
  png: Uint8Array,
  options: TilesetFromPngOptions = {}
): Promise<TilesetAssetDocument> {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    blockLimit = kDefaultBlockLimit
  } = options;
  const buffer = await createPixelBufferFromPng(png);
  const size = buffer.size();

  return createTilesetDocument({
    tileSize,
    pixels: serializePixelBuffer(buffer),
    blocks: blocksFromTileset(
      {
        cols: Math.floor(size.x / tileSize),
        rows: Math.floor(size.y / tileSize)
      },
      { limit: blockLimit }
    )
  });
}

export function encodeTilesetDocument(
  document: TilesetAssetDocument
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}
