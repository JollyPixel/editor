// Import Internal Dependencies
import type { VoxelObjectLayerJSON } from "../../world/objects/types.ts";
import type { TilesetDefinition } from "../../tilesets/types.ts";
import type { VoxelLayerMetadataJSON } from "../types.ts";

export interface VoxelChunkData {
  cx: number;
  cy: number;
  cz: number;
  cells: Uint32Array;
  voxels: Uint32Array;
}

export interface VoxelLayerData extends VoxelLayerMetadataJSON {
  chunks: VoxelChunkData[];
}

export interface VoxelWorldData {
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerData[];
  objectLayers: VoxelObjectLayerJSON[];
}
