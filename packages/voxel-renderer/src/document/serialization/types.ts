// Import Internal Dependencies
import type { VoxelObjectLayerJSON } from "../world/objects/types.ts";
import type { TilesetDefinition } from "../tilesets/types.ts";

export const VOXEL_WORLD_VERSION = 3;

export interface VoxelEntryJSON {
  block: number;
  transform: number;
}

export interface VoxelChunkJSON {
  at: [number, number, number];
  cells?: number[];
  runs: number[];
}

export interface VoxelLayerMetadataJSON {
  compositing?: "replace" | "composite";
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  order: number;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  properties?: Record<string, any>;
}

export interface VoxelLayerJSON extends VoxelLayerMetadataJSON {
  palette: VoxelEntryJSON[];
  chunks: VoxelChunkJSON[];
}

export interface VoxelWorldJSON {
  version: typeof VOXEL_WORLD_VERSION;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
}
