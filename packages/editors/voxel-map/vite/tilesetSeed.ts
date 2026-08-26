// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import type { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import {
  createPixelArtBufferFromPng
} from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";
import {
  resolveTilesetDefinition,
  type ResolvedTilesetDefinition,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer/asset/index.ts";

export interface TilesetSeedOptions {
  file: string;
  definition: TilesetDefinition;
}

export interface TilesetSeed {
  definition: ResolvedTilesetDefinition;
  size: {
    x: number;
    y: number;
  };
  buffer: PixelBuffer;
}

export async function readTilesetSeed(
  options: TilesetSeedOptions
): Promise<TilesetSeed> {
  const {
    file,
    definition
  } = options;

  const buffer = await createPixelArtBufferFromPng(
    await fs.readFile(file)
  );
  const size = buffer.size();

  return {
    definition: resolveTilesetDefinition(definition, {
      width: size.x,
      height: size.y
    }),
    size,
    buffer
  };
}
