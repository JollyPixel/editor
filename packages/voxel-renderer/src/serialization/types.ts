// Import Internal Dependencies
import type { VoxelLayerJSON } from "../world/VoxelLayer.ts";
import type { TilesetDefinition } from "../tileset/types.ts";

export type VoxelObjectProperties = Record<
  string,
  string | number | boolean
>;

export interface VoxelObjectJSON {
  id: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible: boolean;
  color?: string;
  locked?: boolean;
  properties?: VoxelObjectProperties;
}

export interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}

export const VOXEL_WORLD_VERSION = 2;

export interface VoxelWorldJSON {
  version: typeof VOXEL_WORLD_VERSION;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
}
