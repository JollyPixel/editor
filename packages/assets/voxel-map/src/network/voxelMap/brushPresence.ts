// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const VOXEL_BRUSH_PRESENCE_KEY = "brush";

export interface VoxelBrushPresence {
  position: VoxelCoord;
  size: number;
  pattern: string;
}
