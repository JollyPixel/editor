// Import Third-party Dependencies
import {
  createPixelArtDocument,
  createPixelBufferFromPng,
  parsePixelArtDocument,
  serializePixelBuffer,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileset,
  DEFAULT_TILE_SIZE,
  isTileSize,
  TilesetDocument,
  type BlockDefinition,
  type MaterialGroupJSON,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { InvalidTilesetDocumentError } from "./InvalidTilesetDocumentError.ts";

// CONSTANTS
export const TILESET_DOCUMENT_VERSION = 1;
const kDefaultGridSize = 8;
const kDefaultBlockLimit = 32;

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

export function parseTilesetDocument(
  value: unknown
): TilesetAssetDocument {
  if (typeof value !== "object" || value === null) {
    throw new InvalidTilesetDocumentError("payload is not an object");
  }

  const fields: Map<string, unknown> = new Map(Object.entries(value));
  const version = fields.get("version");
  const tileSize = fields.get("tileSize");
  const blocks = fields.get("blocks");
  const materialGroups = fields.get("materialGroups");

  if (version !== TILESET_DOCUMENT_VERSION) {
    throw new InvalidTilesetDocumentError(
      `unsupported version ${String(version)}`
    );
  }
  if (!isTileSize(tileSize)) {
    throw new InvalidTilesetDocumentError("tileSize is not a valid tile size");
  }
  if (!Array.isArray(blocks)) {
    throw new InvalidTilesetDocumentError("blocks is not an array");
  }
  if (!Array.isArray(materialGroups)) {
    throw new InvalidTilesetDocumentError("materialGroups is not an array");
  }

  let pixels: PixelArtDocumentData;
  try {
    pixels = parsePixelArtDocument(fields.get("pixels"));
  }
  catch (error) {
    throw new InvalidTilesetDocumentError("pixels are invalid", { cause: error });
  }

  let document: TilesetDocument;
  try {
    document = new TilesetDocument({
      tileSize,
      blocks,
      materialGroups
    });
  }
  catch (error) {
    throw new InvalidTilesetDocumentError("blocks are invalid", { cause: error });
  }

  return {
    version,
    pixels,
    ...document.toJSON()
  };
}

export function encodeTilesetDocument(
  document: TilesetAssetDocument
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}

export function decodeTilesetDocument(
  content: Uint8Array
): TilesetAssetDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidTilesetDocumentError("payload is not JSON", { cause: error });
  }

  return parseTilesetDocument(parsed);
}
