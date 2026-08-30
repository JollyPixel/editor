// Import Internal Dependencies
import type { VoxelLayerJSON } from "../world/VoxelLayer.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";

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

export interface VoxelWorldJSON {
  version: 1;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  blocks?: ResolvedBlockDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
}
