// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tileset/types.ts";

export interface VoxelMapState {
  readonly world: VoxelWorld;
  tilesets: TilesetDefinition[];
}
