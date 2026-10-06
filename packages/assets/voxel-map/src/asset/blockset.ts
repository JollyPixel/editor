// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  createPixelArtDocument,
  createPixelBufferFromPng,
  PixelDocumentState,
  serializePixelDocument,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileGrid,
  DEFAULT_TILE_SIZE,
  BlocksetDocument,
  type BlockDefinition,
  type MaterialGroupJSON,
  type ResolvedBlockDefinition,
  type BlocksetAssetReference
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BLOCKSET_ICON } from "./icons.ts";

// CONSTANTS
export const BLOCKSET_KIND = "blockset";
export const BLOCKSET_COMMAND = "blockset.command";
export const BLOCKSET_EXTENSION = ".blockset.json";
export const BLOCKSET_DOCUMENT_VERSION = 1;
const kDefaultGridSize = 8;
const kDefaultBlockLimit = 32;

export const BLOCKSET_ASSET: AssetKindDescriptor = {
  kind: BLOCKSET_KIND,
  label: "Blockset",
  extension: BLOCKSET_EXTENSION,
  icon: BLOCKSET_ICON
};

/**
 * The stored form of a blockset: its pixels, tile size, blocks and material
 * groups. Blocks carry blockset-local ids and tile references naming no
 * blockset.
 */
export interface BlocksetAssetDocument {
  version: typeof BLOCKSET_DOCUMENT_VERSION;
  tileSize: number;
  pixels: PixelArtDocumentData;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
}

export interface BlocksetDocumentOptions {
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

export interface BlocksetFromPngOptions {
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

export function blocksetAsset(
  assetId: string
): BlocksetAssetReference {
  return {
    id: assetId,
    kind: BLOCKSET_KIND
  };
}

export function createBlocksetDocument(
  options: BlocksetDocumentOptions = {}
): BlocksetAssetDocument {
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
  const document = new BlocksetDocument({
    tileSize,
    blocks,
    materialGroups
  });

  return {
    version: BLOCKSET_DOCUMENT_VERSION,
    pixels,
    ...document.toJSON()
  };
}

/**
 * Wraps a PNG as a blockset with one cube block per tile.
 */
export async function blocksetDocumentFromPng(
  png: Uint8Array,
  options: BlocksetFromPngOptions = {}
): Promise<BlocksetAssetDocument> {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    blockLimit = kDefaultBlockLimit
  } = options;
  const buffer = await createPixelBufferFromPng(png);
  const size = buffer.size();

  return createBlocksetDocument({
    tileSize,
    pixels: serializePixelDocument(new PixelDocumentState({ buffer })),
    blocks: blocksFromTileGrid(
      {
        cols: Math.floor(size.x / tileSize),
        rows: Math.floor(size.y / tileSize)
      },
      { limit: blockLimit }
    )
  });
}

export function encodeBlocksetDocument(
  document: BlocksetAssetDocument
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}
