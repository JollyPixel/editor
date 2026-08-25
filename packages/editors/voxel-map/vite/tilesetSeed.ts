// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import type { TilesetDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { decodePng } from "./decodePng.ts";

export interface TilesetSeedOptions {
  /** Absolute path of the atlas image shipped with the editor. */
  file: string;
  definition: TilesetDefinition;
}

export interface TilesetSeed {
  definition: TilesetDefinition;
  /** Atlas dimensions, which the pixel-art document adopts. */
  size: { x: number; y: number; };
  buffer: PixelBuffer;
}

/**
 * Reads the atlas the editor ships with so the seeded pixel-art document and
 * the seeded voxel-map document describe the same tileset.
 */
export async function readTilesetSeed(
  options: TilesetSeedOptions
): Promise<TilesetSeed> {
  const { file, definition } = options;

  const {
    width,
    height,
    pixels
  } = decodePng(await fs.readFile(file));
  const size = { x: width, y: height };

  const buffer = new PixelBuffer({
    size,
    maxSize: Math.max(width, height)
  });
  buffer.replacePixels(pixels, size);

  return {
    definition: {
      ...definition,
      cols: Math.floor(width / definition.tileSize),
      rows: Math.floor(height / definition.tileSize)
    },
    size,
    buffer
  };
}
