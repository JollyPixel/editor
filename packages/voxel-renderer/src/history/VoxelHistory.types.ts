// Import Internal Dependencies
import type { VoxelCellChange } from "../world/types.ts";

export interface VoxelHistoryEntry {
  readonly changes: readonly VoxelCellChange[];
}

export interface VoxelHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export type VoxelHistoryEvents = {
  change: (state: VoxelHistoryState) => void;
};
