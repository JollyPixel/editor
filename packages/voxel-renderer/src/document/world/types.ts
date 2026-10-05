// Import Internal Dependencies
import type { PackedVoxel } from "./storage/packedVoxel.ts";

export interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

export interface VoxelEntry {
  blockId: number;
  transform: number;
  /**
   * Second shape sharing the cell, present only on a merged cell.
   */
  partner?: VoxelPart;
}

export interface VoxelPart {
  blockId: number;
  transform: number;
}

export interface VoxelCellChange {
  layerId: string;
  position: VoxelCoord;
  /**
   * `VOXEL_ABSENT` when the cell was empty.
   */
  before: PackedVoxel;
  /**
   * `VOXEL_ABSENT` when the cell was cleared.
   */
  after: PackedVoxel;
  /**
   * `VOXEL_ABSENT` unless the cell was merged before the change.
   */
  beforePartner: PackedVoxel;
  /**
   * `VOXEL_ABSENT` unless the cell is merged after the change.
   */
  afterPartner: PackedVoxel;
}

export interface VoxelEditRecorder {
  /**
   * Receives the cells changed by one non-silent voxel mutation.
   */
  record(changes: VoxelCellChange[]): void;
}

export interface VoxelRecorderOptions {
  includeUnrecorded?: boolean;
}
