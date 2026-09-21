// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { tilesetAsset } from "@jolly-pixel/asset.voxel-map";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  readTilesetSeed,
  type TilesetSeed
} from "./tilesetSeed.ts";
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

export function readDefaultTileset(
  assetId: string
): Promise<TilesetSeed> {
  return readTilesetSeed({
    file: kTilesetFile,
    definition: {
      id: DEFAULT_TILESET_ID,
      asset: tilesetAsset(assetId),
      tileSize: DEFAULT_TILE_SIZE
    }
  });
}
