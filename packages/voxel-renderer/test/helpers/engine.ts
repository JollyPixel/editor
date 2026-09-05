// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../../src/VoxelEngine.types.ts";
import { makeBlockDef } from "./blocks.ts";
import { makeAtlasDef } from "./atlas.ts";
import { mockTexture } from "./mockTexture.ts";

// CONSTANTS
export const CUBE_ID = 1;
export const LEAVES_ID = 2;
export const CHUNK_SIZE = 4;

/**
 * A 4-wide-chunk engine with a single "cube" block and the `makeAtlasDef()`
 * atlas already registered, so meshing succeeds without a GPU texture.
 * `options` is spread last and overrides any of it.
 */
export function makeEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = new VoxelEngine({
    chunkSize: CHUNK_SIZE,
    blocks: [
      makeBlockDef(CUBE_ID, "cube", { name: "Cube" })
    ],
    ...options
  });
  engine.loadTileset(makeAtlasDef(), mockTexture());

  return engine;
}

/**
 * Places one voxel per chunk across `count` chunks along +X, so chunk `i` is
 * centered on `x = (i * CHUNK_SIZE) + 2`.
 */
export function fillChunks(
  engine: VoxelEngine,
  layerName: string,
  count: number,
  blockId = CUBE_ID
): void {
  for (let i = 0; i < count; i++) {
    engine.world.setVoxel(layerName, {
      position: { x: i * CHUNK_SIZE, y: 0, z: 0 },
      blockId
    });
  }
}
