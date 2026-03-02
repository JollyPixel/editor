// Import Third-party Dependencies
import type { Vector3Like } from "three";

export interface VoxelSetOptions {
  position: Vector3Like;
  blockId: number;
  /** Y-axis rotation. Use the `VoxelRotation` constants. Default: `VoxelRotation.None` */
  rotation?: 0 | 1 | 2 | 3;
  /** Mirror the block around x = 0.5. Default: false */
  flipX?: boolean;
  /** Mirror the block around z = 0.5. Default: false */
  flipZ?: boolean;
  /** Mirror the block around y = 0.5. Default: false */
  flipY?: boolean;
}

export interface VoxelRemoveOptions {
  position: Vector3Like;
}
