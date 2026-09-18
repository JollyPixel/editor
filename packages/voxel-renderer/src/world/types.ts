// Import Internal Dependencies
import type { PackedVoxel } from "./packedVoxel.ts";

export interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

export interface VoxelEntry {
  blockId: number;
  transform: number;
}

export interface VoxelCellChange {
  layerName: string;
  position: VoxelCoord;
  /**
   * `VOXEL_ABSENT` when the cell was empty.
   */
  before: PackedVoxel;
  /**
   * `VOXEL_ABSENT` when the cell was cleared.
   */
  after: PackedVoxel;
}

export interface VoxelEditRecorder {
  /**
   * Receives the cells changed by one non-silent voxel mutation.
   */
  record(changes: VoxelCellChange[]): void;
}
