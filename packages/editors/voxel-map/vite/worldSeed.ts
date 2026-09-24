// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  createTilesetDocument,
  tilesetAsset,
  type TilesetDocument
} from "@jolly-pixel/asset.voxel-map";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { DEFAULT_TILESET_ID } from "../src/boot/worldSeed.ts";

export * from "../src/boot/worldSeed.ts";

// CONSTANTS
const kTilesetFile = path.join(
  import.meta.dirname,
  "..",
  "public",
  "textures",
  "tileset.png"
);

export async function readDefaultTileset(
  assetId: string
): Promise<TilesetDocument> {
  return createTilesetDocument(await fs.readFile(kTilesetFile), {
    id: DEFAULT_TILESET_ID,
    asset: tilesetAsset(assetId),
    tileSize: DEFAULT_TILE_SIZE
  });
}
