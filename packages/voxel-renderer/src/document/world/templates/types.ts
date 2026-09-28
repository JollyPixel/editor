// Import Internal Dependencies
import type { VoxelCoord } from "../types.ts";

export interface VoxelTemplatePatch {
  name?: string;
  pivot?: VoxelCoord;
  properties?: Record<string, any>;
}
