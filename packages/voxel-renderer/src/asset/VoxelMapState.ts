// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tileset/TilesetManager.ts";

/**
 * `apply` is the sole world writer. Rooms only read and append.
 *
 * `tilesets` preserves document metadata absent from `VoxelWorld`.
 */
export interface VoxelMapState {
  readonly world: VoxelWorld;
  tilesets: TilesetDefinition[];
}
