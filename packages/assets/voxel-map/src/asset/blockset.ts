// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  createPixelArtFile,
  createPixelBufferFromPng,
  PixelDocumentState,
  serializePixelDocument,
  type PixelArtFile,
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
export const BLOCKSET_FILE_VERSION = 1;
const kDefaultGridSize = 8;
const kDefaultBlockLimit = 32;

export const BLOCKSET_ASSET: AssetKindDescriptor = {
  kind: BLOCKSET_KIND,
  label: "Blockset",
  extension: BLOCKSET_EXTENSION,
  icon: BLOCKSET_ICON
};

export interface BlocksetFile {
  version: typeof BLOCKSET_FILE_VERSION;
  tileSize: number;
  pixels: PixelArtFile;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
}

export interface BlocksetFileOptions {
  /**
   * @default 32
   */
  tileSize?: number;
  /**
   * Blank pixels of this size when `pixels` is absent.
   * @default 8 by 8 tiles
   */
  size?: Vec2;
  pixels?: PixelArtFile;
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

export function createBlocksetFile(
  options: BlocksetFileOptions = {}
): BlocksetFile {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    blocks = [],
    materialGroups = []
  } = options;
  const pixels = options.pixels ?? createPixelArtFile(
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
    version: BLOCKSET_FILE_VERSION,
    pixels,
    ...document.toJSON()
  };
}

export async function blocksetFileFromPng(
  png: Uint8Array,
  options: BlocksetFromPngOptions = {}
): Promise<BlocksetFile> {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    blockLimit = kDefaultBlockLimit
  } = options;
  const buffer = await createPixelBufferFromPng(png);
  const size = buffer.size();

  return createBlocksetFile({
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

export function encodeBlocksetFile(
  file: BlocksetFile
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(file));
}
