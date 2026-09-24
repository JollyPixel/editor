// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  createStudioProject,
  type StudioProject
} from "../../src/seed.ts";

// CONSTANTS
const kTilesetFile = path.join(import.meta.dirname, "tileset.png");

export async function readStudioProject(): Promise<StudioProject> {
  return createStudioProject(
    await fs.readFile(kTilesetFile)
  );
}
