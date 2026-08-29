// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tileset/TilesetManager.ts";

/**
 * Stores the authoritative world and its separate tileset metadata.
 */
export interface VoxelMapState {
  readonly world: VoxelWorld;
  tilesets: TilesetDefinition[];
}
