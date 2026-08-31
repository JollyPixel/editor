// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { VoxelTransformOptions } from "./world/VoxelTransform.ts";

/**
 * Rotation and flip flags use the `VoxelRotation` constants and default to
 * an identity transform.
 */
export interface VoxelSetOptions extends VoxelTransformOptions {
  position: Vector3Like;
  blockId: number;
}

export interface VoxelRemoveOptions {
  position: Vector3Like;
}

export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;
