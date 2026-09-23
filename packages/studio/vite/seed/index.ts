// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  createStudioSeedFromPng,
  type StudioSeed
} from "../../src/seed.ts";

export { CHUNK_SIZE } from "../../src/seed.ts";

// CONSTANTS
const kTilesetFile = path.join(import.meta.dirname, "tileset.png");

export async function createStudioSeed(): Promise<StudioSeed> {
  return createStudioSeedFromPng(await fs.readFile(kTilesetFile));
}
