// Import Internal Dependencies
import type { VoxelObjectLayerJSON } from "../../world/objects/types.ts";
import type { BlocksetDefinition } from "../../blocksets/types.ts";
import type {
  VoxelLayerMetadataJSON,
  VoxelTemplateJSON
} from "../types.ts";

export interface VoxelCellData {
  cells: Uint32Array;
  voxels: Uint32Array;
}

export interface VoxelChunkData extends VoxelCellData {
  cx: number;
  cy: number;
  cz: number;
  partners?: VoxelCellData;
}

export interface VoxelLayerData extends VoxelLayerMetadataJSON {
  chunks: VoxelChunkData[];
}

export interface VoxelTemplateData extends Omit<
  VoxelTemplateJSON,
  "palette" | "chunks"
> {
  chunks: VoxelChunkData[];
}

export interface VoxelWorldData {
  chunkSize: number;
  blocksets: BlocksetDefinition[];
  layers: VoxelLayerData[];
  objectLayers: VoxelObjectLayerJSON[];
  templates: VoxelTemplateData[];
}
