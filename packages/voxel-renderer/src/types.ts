// Import Third-party Dependencies
import type { Vector3Like } from "three";

export interface VoxelSetOptions {
  position: Vector3Like;
  blockId: number;
  /**
   * Y-axis rotation using the `VoxelRotation` constants.
   * @default VoxelRotation.None
   */
  rotation?: 0 | 1 | 2 | 3;
  /**
   * Mirrors the block around x = 0.5.
   * @default false
   */
  flipX?: boolean;
  /**
   * Mirrors the block around z = 0.5.
   * @default false
   */
  flipZ?: boolean;
  /**
   * Mirrors the block around y = 0.5.
   * @default false
   */
  flipY?: boolean;
}

export interface VoxelRemoveOptions {
  position: Vector3Like;
}

export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;
