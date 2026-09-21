// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import type { TilesetDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  tilesetSeedFromPng,
  type TilesetSeed
} from "../src/boot/worldSeed.ts";

export type { TilesetSeed };

export interface TilesetSeedOptions {
  file: string;
  definition: TilesetDefinition;
}

export async function readTilesetSeed(
  options: TilesetSeedOptions
): Promise<TilesetSeed> {
  return tilesetSeedFromPng(
    await fs.readFile(options.file),
    options.definition
  );
}
