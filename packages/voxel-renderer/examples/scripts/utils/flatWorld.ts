// Import Internal Dependencies
import type { VoxelWorld } from "../../../src/world/VoxelWorld.ts";
import { TerrainBlock } from "./terrain.ts";

// CONSTANTS
/** Room id shared by the client (demo-flat-world.ts) and the server (vite.config.ts). */
export const FLAT_WORLD_ROOM = "voxel-renderer:flat-world";
/** The only layer of the demo. Created server-side, never by a client. */
export const GROUND_LAYER = "Ground";
/** Floor width and depth, in voxels. */
export const FLOOR_SIZE = 32;
/** Must match on both sides: a mismatch silently misplaces every voxel. */
export const CHUNK_SIZE = 16;
export const FLOOR_BLOCK_ID = TerrainBlock.Grass;
export const PLACED_BLOCK_ID = TerrainBlock.Stone;

/**
 * Builds the authoritative starting world: one layer holding a flat
 * `FLOOR_SIZE`² floor at y = 0.
 *
 * Only the server calls this. Clients join with zero layers and take
 * everything from the first snapshot, so there is no local state that a
 * snapshot could disagree with (see docs/guides/synchronizing-a-world.md).
 */
export function seedFlatWorld(
  world: VoxelWorld
): void {
  world.addLayer(GROUND_LAYER);

  for (let x = 0; x < FLOOR_SIZE; x++) {
    for (let z = 0; z < FLOOR_SIZE; z++) {
      world.setVoxelAt(
        GROUND_LAYER,
        { x, y: 0, z },
        { blockId: FLOOR_BLOCK_ID, transform: 0 }
      );
    }
  }
}
