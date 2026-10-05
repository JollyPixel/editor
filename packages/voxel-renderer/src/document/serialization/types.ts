// Import Internal Dependencies
import type { VoxelObjectLayerJSON } from "../world/objects/types.ts";
import type { TilesetDefinition } from "../tilesets/types.ts";

export const VOXEL_WORLD_VERSION = 4;

export interface VoxelEntryJSON {
  block: number;
  transform: number;
}

export interface VoxelChunkPartnersJSON {
  cells?: number[];
  runs: number[];
}

export interface VoxelChunkJSON {
  at: [number, number, number];
  cells?: number[];
  runs: number[];
  partners?: VoxelChunkPartnersJSON;
}

export interface VoxelLayerMetadataJSON {
  compositing?: "replace" | "composite";
  id: string;
  name: string;
  visible: boolean;
  rank: string;
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

export interface VoxelTemplateJSON {
  id: string;
  name: string;
  pivot: {
    x: number;
    y: number;
    z: number;
  };
  properties?: Record<string, any>;
  chunkSize: number;
  palette: VoxelEntryJSON[];
  chunks: VoxelChunkJSON[];
}

export interface VoxelWorldJSON {
  version: typeof VOXEL_WORLD_VERSION;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
  templates?: VoxelTemplateJSON[];
}
