// Import Internal Dependencies
import type {
  QuaternionLike,
  Vector3Like
} from "./vectors.ts";

export interface BoxShape {
  type: "box";
  halfExtents: Vector3Like;
}

export interface SphereShape {
  type: "sphere";
  radius: number;
}

export interface CapsuleShape {
  type: "capsule";
  halfHeight: number;
  radius: number;
}

export interface TrimeshShape {
  type: "trimesh";
  vertices: Float32Array;
  indices: Uint32Array;
}

export type ColliderShape =
  | BoxShape
  | SphereShape
  | CapsuleShape
  | TrimeshShape;

export interface ColliderDesc {
  shape: ColliderShape;
  /**
   * Position relative to the body.
   * @default { x: 0, y: 0, z: 0 }
   */
  offset?: Vector3Like;
  /**
   * Rotation relative to the body.
   * @default { x: 0, y: 0, z: 0, w: 1 }
   */
  rotation?: QuaternionLike;
  /**
   * @default 0.5
   */
  friction?: number;
  /**
   * @default 0
   */
  restitution?: number;
  /**
   * @default 1
   */
  density?: number;
  /**
   * Reports contacts without a collision response.
   * @default false
   */
  sensor?: boolean;
}

export const COLLIDER_DEFAULTS = {
  friction: 0.5,
  restitution: 0,
  density: 1,
  sensor: false
} as const;
