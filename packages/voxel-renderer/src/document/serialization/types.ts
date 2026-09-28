// Import Internal Dependencies
import type { VoxelObjectLayerJSON } from "../world/objects/types.ts";
import type { TilesetDefinition } from "../tilesets/types.ts";

export const VOXEL_WORLD_VERSION = 2;

/**
 * Sparse serialized voxel key containing its layer-local position.
 */
export type VoxelEntryKey = `${number},${number},${number}`;

export interface VoxelEntryJSON {
  block: number;
  transform: number;
}

export interface VoxelLayerJSON {
  compositing?: "replace" | "composite";
  id: string;
  name: string;
  visible: boolean;
  /**
   * Rendered translucency, from `0` (fully transparent) to `1` (fully opaque).
   * Absent in files serialized before this field existed; treat as `1`.
   */
  opacity?: number;
  order: number;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

export interface VoxelWorldJSON {
  version: typeof VOXEL_WORLD_VERSION;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
}
